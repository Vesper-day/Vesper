import { DailyPlanSchema, type DailyPlan, type Archetype } from '@vesper/shared';
import nineToFivePlan from './plans/nine_to_five.json';
import remotePlan from './plans/remote.json';
import studentPlan from './plans/student.json';
import athletePlan from './plans/athlete.json';
import founderPlan from './plans/founder.json';
import mixedPlan from './plans/mixed.json';

const FALLBACK_PLANS: Record<Archetype, unknown> = {
  nine_to_five: nineToFivePlan,
  remote: remotePlan,
  student: studentPlan,
  athlete: athletePlan,
  founder: founderPlan,
  mixed: mixedPlan,
};

/**
 * Returns a hardcoded archetype-default DailyPlan when synthesis is unavailable.
 * _planDate: accepted for parity with the synthesis path; the schema's block times
 * are bare "HH:MM" with no date field, so there is nothing to stamp it into here.
 */
export function getFallbackPlan(archetype: Archetype, _planDate: Date): DailyPlan {
  const clone = structuredClone(FALLBACK_PLANS[archetype]);
  return DailyPlanSchema.parse(clone);
}
