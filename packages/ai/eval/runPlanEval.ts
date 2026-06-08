// CLI harness: runs every fixture through the stub synthesizer, validates
// each resulting DailyPlan against the real schema, and writes outputs to a
// timestamped run directory for manual rubric scoring (see SCORING_RUBRIC.md).

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DailyPlanSchema, type Archetype } from '@vesper/shared';
import { synthesizePlan } from './stubSynthesizePlan';

const EVAL_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(EVAL_DIR, 'fixtures');
const OUTPUT_DIR = join(EVAL_DIR, 'output');

interface FixtureProfile {
  archetype: Archetype;
  [key: string]: unknown;
}

interface FixtureRuntimeInputs {
  planDate: string;
  [key: string]: unknown;
}

interface FixtureFile {
  name: string;
  exercises: string;
  profile: FixtureProfile;
  runtimeInputs: FixtureRuntimeInputs;
}

function isoTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function main(): Promise<void> {
  const fixtureFiles = readdirSync(FIXTURES_DIR)
    .filter((entry) => entry.endsWith('.json'))
    .sort();

  const runDir = join(OUTPUT_DIR, isoTimestamp());
  mkdirSync(runDir, { recursive: true });

  let passed = 0;

  for (const fileName of fixtureFiles) {
    const raw = readFileSync(join(FIXTURES_DIR, fileName), 'utf-8');
    const fixture = JSON.parse(raw) as FixtureFile;

    const archetype = fixture.profile.archetype;
    const planDate = new Date(`${fixture.runtimeInputs.planDate}T00:00:00`);

    // Minimal inline context standing in for Chat 021's buildPlanContext output;
    // the stub ignores it entirely — included only so the harness's call shape
    // mirrors what Chat 022's real synthesizePlan will eventually receive.
    const _context = {
      archetype,
      planDate,
      profile: fixture.profile,
      runtimeInputs: fixture.runtimeInputs,
    };

    const plan = await synthesizePlan({ archetype, planDate });
    const result = DailyPlanSchema.safeParse(plan);

    if (result.success) {
      passed += 1;
      console.log(`[PASS] ${fixture.name} (${fixture.exercises})`);
    } else {
      console.error(`[FAIL] ${fixture.name}: schema validation failed`);
      console.error(result.error.issues);
    }

    writeFileSync(join(runDir, `${fixture.name}.json`), JSON.stringify(plan, null, 2), 'utf-8');
  }

  console.log('');
  console.log(`${passed}/${fixtureFiles.length} fixtures parsed against DailyPlanSchema`);
  console.log(`Output written to: ${runDir}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
