import { describe, expect, it } from 'vitest';
import { DailyPlanSchema, type Archetype } from '@vesper/shared';
import { getFallbackPlan } from '../fallback';
import nineToFivePlan from '../fallback/plans/nine_to_five.json';
import remotePlan from '../fallback/plans/remote.json';
import studentPlan from '../fallback/plans/student.json';
import athletePlan from '../fallback/plans/athlete.json';
import founderPlan from '../fallback/plans/founder.json';
import mixedPlan from '../fallback/plans/mixed.json';

const ARCHETYPES: Archetype[] = ['nine_to_five', 'remote', 'student', 'athlete', 'founder', 'mixed'];

const PLAN_JSON: Record<Archetype, unknown> = {
  nine_to_five: nineToFivePlan,
  remote: remotePlan,
  student: studentPlan,
  athlete: athletePlan,
  founder: founderPlan,
  mixed: mixedPlan,
};

describe('fallback plan JSON — schema contract', () => {
  for (const archetype of ARCHETYPES) {
    it(`${archetype}.json satisfies DailyPlanSchema`, () => {
      const result = DailyPlanSchema.safeParse(PLAN_JSON[archetype]);
      expect(result.success).toBe(true);
    });
  }
});

describe('getFallbackPlan', () => {
  for (const archetype of ARCHETYPES) {
    it(`returns a schema-valid DailyPlan for "${archetype}" without throwing`, () => {
      const plan = getFallbackPlan(archetype, new Date());
      const result = DailyPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
      expect(plan.blocks.length).toBeGreaterThan(0);
    });
  }

  it('returns a fresh deep clone on every call (mutation does not leak across calls)', () => {
    const first = getFallbackPlan('mixed', new Date());
    const firstBlock = first.blocks[0]!;
    firstBlock.title = 'Mutated title';
    firstBlock.startTime = '00:01';

    const second = getFallbackPlan('mixed', new Date());
    const secondBlock = second.blocks[0]!;

    expect(secondBlock.title).not.toBe('Mutated title');
    expect(secondBlock.startTime).not.toBe('00:01');
  });
});
