// STUB. Chat 022 replaces this with the real streaming synthesizePlan
// and re-runs this harness. Delegates to getFallbackPlan so the eval
// has a real DailyPlan to score.

import { type DailyPlan, type Archetype } from '@vesper/shared';
import { getFallbackPlan } from '../src/fallback';

export async function synthesizePlan(input: { archetype: Archetype; planDate: Date }): Promise<DailyPlan> {
  return getFallbackPlan(input.archetype, input.planDate);
}
