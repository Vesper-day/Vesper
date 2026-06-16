// Build packages/db/seed/workout_templates.json from the ExerciseDB API.
//
// ExerciseDB's free RapidAPI tier hard-caps every endpoint (incl. /exercises and each
// filter route) at 10 rows. To assemble a usable pool we UNION every per-bodyPart,
// per-equipment and per-target filter endpoint and dedupe by exercise id. The individual
// exercises are then AGGREGATED into ~150 workout templates keyed by (bodyPart, equipment),
// with duration bucketed to {15,30,45,60}, intensity to an integer 1..10, and level taken
// from ExerciseDB's own difficulty field (already the workout_level_enum domain).
//
// Every emitted row is validated with workoutTemplateRow.parse() before writing; the first
// invalid row throws with its field + value. Run: tsx seed/scripts/buildWorkoutTemplates.ts

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { workoutTemplateRow, type WorkoutTemplateRow } from './templateRowSchemas';

const HOST = 'exercisedb.p.rapidapi.com';
const BASE = `https://${HOST}`;
const OUT = resolve(__dirname, '../workout_templates.json');
const TARGET_TEMPLATES = 150;

interface Exercise {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
  difficulty: string; // beginner | intermediate | advanced
  category?: string;
  instructions?: string[];
}

function requireKey(): string {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) {
    throw new Error('RAPIDAPI_KEY is not set — refusing to run (never hardcode the key).');
  }
  return key;
}

async function getJson<T>(key: string, path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': HOST },
  });
  if (!res.ok) {
    throw new Error(`ExerciseDB ${path} -> HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

// Union every filter endpoint, deduping by exercise id.
async function fetchExercisePool(key: string): Promise<Exercise[]> {
  const [bodyParts, equipment, targets] = await Promise.all([
    getJson<string[]>(key, '/exercises/bodyPartList'),
    getJson<string[]>(key, '/exercises/equipmentList'),
    getJson<string[]>(key, '/exercises/targetList'),
  ]);

  const routes: string[] = [
    ...bodyParts.map((v) => `/exercises/bodyPart/${encodeURIComponent(v)}?limit=10`),
    ...equipment.map((v) => `/exercises/equipment/${encodeURIComponent(v)}?limit=10`),
    ...targets.map((v) => `/exercises/target/${encodeURIComponent(v)}?limit=10`),
  ];

  const pool = new Map<string, Exercise>();
  for (const route of routes) {
    const rows = await getJson<Exercise[]>(key, route);
    for (const ex of rows) {
      if (ex && ex.id && !pool.has(ex.id)) pool.set(ex.id, ex);
    }
  }
  console.log(
    `Fetched pool: ${pool.size} distinct exercises across ${routes.length} filter routes.`,
  );
  return [...pool.values()].sort((a, b) => a.id.localeCompare(b.id));
}

// --- aggregation helpers -----------------------------------------------------

const GOAL_BY_BODYPART: Record<string, string[]> = {
  waist: ['core', 'strength'],
  back: ['strength', 'upper_body'],
  chest: ['strength', 'upper_body'],
  shoulders: ['strength', 'upper_body'],
  'upper arms': ['strength', 'upper_body'],
  'lower arms': ['strength', 'upper_body'],
  'upper legs': ['strength', 'lower_body'],
  'lower legs': ['strength', 'lower_body'],
  neck: ['mobility'],
  cardio: ['cardio', 'endurance'],
};

function goalTags(bodyPart: string): string[] {
  return GOAL_BY_BODYPART[bodyPart] ?? ['strength'];
}

function equipmentTag(equipment: string): string {
  if (equipment === 'body weight') return 'bodyweight';
  return equipment.trim().replace(/\s+/g, '_');
}

const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
type Level = (typeof LEVELS)[number];

function isLevel(v: string): v is Level {
  return (LEVELS as readonly string[]).includes(v);
}

// Most common difficulty in a chunk, defaulting to intermediate.
function modeLevel(chunk: Exercise[]): Level {
  const counts: Record<Level, number> = { beginner: 0, intermediate: 0, advanced: 0 };
  for (const ex of chunk) if (isLevel(ex.difficulty)) counts[ex.difficulty] += 1;
  let best: Level = 'intermediate';
  let bestN = -1;
  for (const lvl of LEVELS) {
    if (counts[lvl] > bestN) {
      bestN = counts[lvl];
      best = lvl;
    }
  }
  return best;
}

// Duration tiers: a longer session simply prescribes more exercises from the same group.
// Each tier that a group can satisfy becomes a genuinely distinct template.
const TIERS: { duration: 15 | 30 | 45 | 60; count: number; bump: number }[] = [
  { duration: 15, count: 2, bump: -1 },
  { duration: 30, count: 3, bump: 0 },
  { duration: 45, count: 5, bump: 1 },
  { duration: 60, count: 7, bump: 1 },
];

const INTENSITY_BASE: Record<Level, number> = { beginner: 3, intermediate: 6, advanced: 9 };
const HEAVY_EQUIPMENT = new Set([
  'barbell',
  'olympic barbell',
  'ez barbell',
  'trap bar',
  'smith machine',
  'kettlebell',
]);

function intensityFor(level: Level, bodyPart: string, equipment: string, bump: number): number {
  let score = INTENSITY_BASE[level] + bump;
  if (bodyPart === 'cardio') score += 1;
  if (HEAVY_EQUIPMENT.has(equipment)) score += 1;
  if (equipment === 'body weight') score -= 1;
  return Math.max(1, Math.min(10, score));
}

function repScheme(bodyPart: string, target: string): { sets: number; reps: string } {
  if (bodyPart === 'cardio' || target === 'cardiovascular system')
    return { sets: 1, reps: '30-60 sec' };
  if (bodyPart === 'waist') return { sets: 3, reps: '12-20' };
  if (bodyPart === 'neck') return { sets: 2, reps: '10-15' };
  return { sets: 4, reps: '8-12' };
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildTemplates(pool: Exercise[]): WorkoutTemplateRow[] {
  // Group by (bodyPart, equipment).
  const groups = new Map<string, Exercise[]>();
  for (const ex of pool) {
    const k = `${ex.bodyPart}|${ex.equipment}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(ex);
  }

  const candidates: { row: WorkoutTemplateRow; weight: number }[] = [];
  const usedNames = new Set<string>();

  for (const key of [...groups.keys()].sort()) {
    const [bodyPart, equipment] = key.split('|');
    const exs = groups.get(key)!;
    if (exs.length < 2) continue; // need at least 2 exercises for a real session

    for (const tier of TIERS) {
      if (exs.length < tier.count) continue;
      const selection = exs.slice(0, tier.count);
      const level = modeLevel(selection);
      const intensity = intensityFor(level, bodyPart, equipment, tier.bump);

      let name = `${titleCase(bodyPart)} ${titleCase(equipment)} — ${titleCase(level)} (${tier.duration} min)`;
      let suffix = 1;
      while (usedNames.has(name)) {
        suffix += 1;
        name = `${titleCase(bodyPart)} ${titleCase(equipment)} — ${titleCase(level)} (${tier.duration} min) #${suffix}`;
      }
      usedNames.add(name);

      const row: WorkoutTemplateRow = {
        name,
        goal_tags: goalTags(bodyPart),
        equipment_tags: [equipmentTag(equipment)],
        duration_minutes: tier.duration,
        level,
        intensity_score: intensity,
        content: {
          focus: bodyPart,
          exercises: selection.map((ex) => {
            const { sets, reps } = repScheme(ex.bodyPart, ex.target);
            return {
              name: ex.name,
              target: ex.target,
              bodyPart: ex.bodyPart,
              equipment: ex.equipment,
              sets,
              reps,
            };
          }),
        },
        source: 'exercisedb',
      };
      candidates.push({ row, weight: exs.length });
    }
  }

  // Prefer templates drawn from richer groups; cap at the target count.
  candidates.sort((a, b) => b.weight - a.weight || a.row.name.localeCompare(b.row.name));
  return candidates.slice(0, TARGET_TEMPLATES).map((c) => c.row);
}

async function main(): Promise<void> {
  const key = requireKey();
  const pool = await fetchExercisePool(key);
  if (pool.length === 0) throw new Error('Empty exercise pool — aborting.');

  const rows = buildTemplates(pool);

  // Validate every row; throw on first failure with field + value.
  rows.forEach((row, i) => {
    const parsed = workoutTemplateRow.safeParse(row);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue.path.join('.');
      const value = JSON.stringify(issue.path.reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], row));
      throw new Error(
        `Row ${i} ("${row.name}") failed validation at "${field}": ${issue.message} (value=${value})`,
      );
    }
  });

  writeFileSync(OUT, JSON.stringify(rows, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${rows.length} workout templates -> ${OUT}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
