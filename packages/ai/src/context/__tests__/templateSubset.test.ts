import { describe, expect, it } from 'vitest';
import type { ModulesEnabled, Database } from '@vesper/db';
import { workoutTemplates, recipeTemplates } from '@vesper/db';
import {
  buildTemplateSubset,
  filterWorkouts,
  filterRecipes,
  type WorkoutTemplate,
  type RecipeTemplate,
} from '../templateSubset';

// --- row factories -----------------------------------------------------------
// Only the predicate-relevant columns matter; the rest are filled to satisfy the
// inferred-select shape.

function workout(p: Partial<WorkoutTemplate>): WorkoutTemplate {
  return {
    id: p.id ?? crypto.randomUUID(),
    name: p.name ?? 'w',
    goalTags: p.goalTags ?? [],
    equipmentTags: p.equipmentTags ?? [],
    durationMinutes: p.durationMinutes ?? 30,
    level: p.level ?? 'beginner',
    intensityScore: p.intensityScore ?? 5,
    content: p.content ?? {},
    source: p.source ?? 'test',
    createdAt: p.createdAt ?? new Date(),
  } as WorkoutTemplate;
}

function recipe(p: Partial<RecipeTemplate>): RecipeTemplate {
  return {
    id: p.id ?? crypto.randomUUID(),
    name: p.name ?? 'r',
    cuisineTags: p.cuisineTags ?? [],
    dietTags: p.dietTags ?? [],
    prepMinutes: p.prepMinutes ?? 10,
    cookMinutes: p.cookMinutes ?? 10,
    totalMinutes: p.totalMinutes ?? 20,
    difficulty: p.difficulty ?? 'easy',
    macros: p.macros ?? {},
    servings: p.servings ?? 2,
    ingredients: p.ingredients ?? [],
    instructions: p.instructions ?? [],
    imageUrl: p.imageUrl ?? null,
    source: p.source ?? 'test',
    createdAt: p.createdAt ?? new Date(),
  } as RecipeTemplate;
}

// --- pure predicate helpers (pin direction + limits) -------------------------

describe('filterWorkouts', () => {
  it('keeps only templates whose goalTags contain the scalar goal', () => {
    const rows = [
      workout({ name: 'a', goalTags: ['strength', 'lower_body'] }),
      workout({ name: 'b', goalTags: ['cardio'] }),
    ];
    const out = filterWorkouts(rows, {
      enabled: true,
      goal: 'strength',
      equipment: [],
      level: undefined,
    } as ModulesEnabled['fitness']);
    expect(out.map((r) => r.name)).toEqual(['a']);
  });

  it('keeps only templates whose equipmentTags are a subset of the user equipment', () => {
    const rows = [
      workout({ name: 'bodyweight', equipmentTags: [] }),
      workout({ name: 'dumbbell-only', equipmentTags: ['dumbbell'] }),
      workout({ name: 'needs-barbell', equipmentTags: ['dumbbell', 'barbell'] }),
    ];
    const out = filterWorkouts(rows, {
      enabled: true,
      equipment: ['dumbbell'],
    } as ModulesEnabled['fitness']);
    expect(out.map((r) => r.name)).toEqual(['bodyweight', 'dumbbell-only']);
  });

  it('empty user equipment keeps only no-equipment workouts', () => {
    const rows = [
      workout({ name: 'bodyweight', equipmentTags: [] }),
      workout({ name: 'dumbbell', equipmentTags: ['dumbbell'] }),
    ];
    const out = filterWorkouts(rows, {
      enabled: true,
      equipment: [],
    } as ModulesEnabled['fitness']);
    expect(out.map((r) => r.name)).toEqual(['bodyweight']);
  });

  it('keeps templates at or below the user level (beginner<intermediate<advanced)', () => {
    const rows = [
      workout({ name: 'beg', level: 'beginner' }),
      workout({ name: 'int', level: 'intermediate' }),
      workout({ name: 'adv', level: 'advanced' }),
    ];
    const out = filterWorkouts(rows, {
      enabled: true,
      equipment: [],
      level: 'intermediate',
    } as ModulesEnabled['fitness']);
    expect(out.map((r) => r.name)).toEqual(['beg', 'int']);
  });

  it('caps the result at 10', () => {
    const rows = Array.from({ length: 25 }, (_, i) =>
      workout({ name: `w${i}`, equipmentTags: [] }),
    );
    const out = filterWorkouts(rows, {
      enabled: true,
      equipment: [],
    } as ModulesEnabled['fitness']);
    expect(out).toHaveLength(10);
  });
});

describe('filterRecipes', () => {
  it('keeps only templates whose dietTags contain every user diet tag', () => {
    const rows = [
      recipe({ name: 'vegan-gf', dietTags: ['vegan', 'gluten_free'] }),
      recipe({ name: 'vegan-only', dietTags: ['vegan'] }),
      recipe({ name: 'none', dietTags: [] }),
    ];
    const out = filterRecipes(rows, {
      enabled: true,
      dietTags: ['vegan', 'gluten_free'],
      dislikes: [],
    } as ModulesEnabled['nutrition']);
    expect(out.map((r) => r.name)).toEqual(['vegan-gf']);
  });

  it('empty user dietTags is a no-op (all recipes pass)', () => {
    const rows = [recipe({ name: 'a' }), recipe({ name: 'b' })];
    const out = filterRecipes(rows, {
      enabled: true,
      dietTags: [],
      dislikes: [],
    } as ModulesEnabled['nutrition']);
    expect(out.map((r) => r.name)).toEqual(['a', 'b']);
  });

  it('keeps only templates at or under the cooking-time ceiling', () => {
    const rows = [
      recipe({ name: 'quick', totalMinutes: 20 }),
      recipe({ name: 'slow', totalMinutes: 90 }),
    ];
    const out = filterRecipes(rows, {
      enabled: true,
      dietTags: [],
      dislikes: [],
      cookingTimeMaxMinutes: 30,
    } as ModulesEnabled['nutrition']);
    expect(out.map((r) => r.name)).toEqual(['quick']);
  });

  it('caps the result at 15', () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      recipe({ name: `r${i}` }),
    );
    const out = filterRecipes(rows, {
      enabled: true,
      dietTags: [],
      dislikes: [],
    } as ModulesEnabled['nutrition']);
    expect(out).toHaveLength(15);
  });
});

// --- buildTemplateSubset gating + injected-db wiring -------------------------

function fakeDb(
  canned: { workouts: WorkoutTemplate[]; recipes: RecipeTemplate[] },
): { db: Database; queried: unknown[] } {
  const queried: unknown[] = [];
  const db = {
    select: () => ({
      from: (table: unknown) => {
        queried.push(table);
        if (table === workoutTemplates) return Promise.resolve(canned.workouts);
        if (table === recipeTemplates) return Promise.resolve(canned.recipes);
        return Promise.resolve([]);
      },
    }),
  } as unknown as Database;
  return { db, queried };
}

const allDisabled: ModulesEnabled = {
  work: { enabled: false },
  fitness: { enabled: false, equipment: [] },
  nutrition: { enabled: false, dietTags: [], dislikes: [] },
  sleep: { enabled: false },
  errands: { enabled: false },
  medication: { enabled: false },
  finance: { enabled: false },
};

describe('buildTemplateSubset', () => {
  it('returns empty lists and issues no query when fitness and nutrition are off', async () => {
    const { db, queried } = fakeDb({ workouts: [], recipes: [] });
    const subset = await buildTemplateSubset(allDisabled, db);
    expect(subset).toEqual({ workouts: [], recipes: [] });
    expect(queried).toHaveLength(0);
  });

  it('queries and filters workouts when fitness is enabled, skips recipes when nutrition is off', async () => {
    const { db, queried } = fakeDb({
      workouts: [
        workout({ name: 'keep', goalTags: ['strength'], equipmentTags: [] }),
        workout({ name: 'drop', goalTags: ['cardio'], equipmentTags: [] }),
      ],
      recipes: [recipe({ name: 'r' })],
    });
    const modules: ModulesEnabled = {
      ...allDisabled,
      fitness: { enabled: true, goal: 'strength', equipment: [] },
    };
    const subset = await buildTemplateSubset(modules, db);
    expect(subset.workouts.map((r) => r.name)).toEqual(['keep']);
    expect(subset.recipes).toEqual([]);
    expect(queried).toEqual([workoutTemplates]);
  });

  it('queries and filters recipes when nutrition is enabled, skips workouts when fitness is off', async () => {
    const { db, queried } = fakeDb({
      workouts: [workout({ name: 'w' })],
      recipes: [
        recipe({ name: 'quick', totalMinutes: 20 }),
        recipe({ name: 'slow', totalMinutes: 90 }),
      ],
    });
    const modules: ModulesEnabled = {
      ...allDisabled,
      nutrition: {
        enabled: true,
        dietTags: [],
        dislikes: [],
        cookingTimeMaxMinutes: 30,
      },
    };
    const subset = await buildTemplateSubset(modules, db);
    expect(subset.recipes.map((r) => r.name)).toEqual(['quick']);
    expect(subset.workouts).toEqual([]);
    expect(queried).toEqual([recipeTemplates]);
  });
});
