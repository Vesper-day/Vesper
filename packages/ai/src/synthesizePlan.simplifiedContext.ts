// Simplified daily-plan context for the Step-2 retry (Chat 022, §5 fallback chain).
//
// Step 2 retries with a SMALLER prompt after the full-context initial call and
// the identical Step-1 retry both fail. It mirrors context/planContext.ts's
// four-layer assembly but trims the two most expensive, least-essential inputs:
//   - Layer 3 (template subset) sliced to 5 workouts + 5 recipes (guarded, since
//     noUncheckedIndexedAccess is on and the lists can be empty/shorter).
//   - Layer 4 reduced to { planDate, energyScore, promptVersion } only — pending
//     tasks and calendar are dropped so the model has a strictly lighter ask.
//
// ASSEMBLES ONLY (same contract as planContext.ts): no Anthropic call here.

import type { CoreMessage } from 'ai';
import type { Database } from '@vesper/db';

import { getProviderOptions } from './cacheConfig';
import {
  DAILY_PLAN_SYNTHESIS_PROMPT,
  DAILY_PLAN_SYNTHESIS_VERSION,
} from './prompts/dailyPlanSynthesis';
import { buildUserContext } from './context/userContext';
import { buildTemplateSubset } from './context/templateSubset';
import type { PlanContext } from './context/planContext';

/** Step-2 ceilings: the simplified context carries at most this many of each. */
const SIMPLIFIED_WORKOUT_LIMIT = 5;
const SIMPLIFIED_RECIPE_LIMIT = 5;

/**
 * Assemble the trimmed four-layer context for the Step-2 simplified retry.
 *
 * @param db Optional Drizzle client (injected in tests); forwarded to buildUserContext.
 */
export async function buildSimplifiedPlanContext(
  userId: string,
  planDate: string,
  energyScore: number | null,
  db?: Database,
): Promise<PlanContext> {
  const userContext = await buildUserContext(userId, db);
  const templateSubset = await buildTemplateSubset(userContext.modulesEnabled);

  const cache = getProviderOptions('daily-plan');

  const systemMessage: CoreMessage = {
    role: 'system',
    content: DAILY_PLAN_SYNTHESIS_PROMPT,
    providerOptions: cache,
  };

  // Layer 2 — unchanged static-ish user context.
  const layer2 = `USER CONTEXT\n${JSON.stringify(userContext, null, 2)}`;

  // Layer 3 — sliced to the simplified ceilings. slice() is safe on a short or
  // empty array; no bare index access, so noUncheckedIndexedAccess is satisfied.
  const trimmedSubset = {
    workouts: templateSubset.workouts.slice(0, SIMPLIFIED_WORKOUT_LIMIT),
    recipes: templateSubset.recipes.slice(0, SIMPLIFIED_RECIPE_LIMIT),
  };
  const layer3 = `TEMPLATE LIBRARY SUBSET\n${JSON.stringify(trimmedSubset, null, 2)}`;

  // Layer 4 — reduced: tasks and calendar dropped. promptVersion still rides here.
  const layer4 = `TODAY\n${JSON.stringify(
    {
      planDate,
      energyScore,
      promptVersion: DAILY_PLAN_SYNTHESIS_VERSION,
    },
    null,
    2,
  )}`;

  const userMessage: CoreMessage = {
    role: 'user',
    content: [
      { type: 'text', text: layer2, providerOptions: cache },
      { type: 'text', text: layer3, providerOptions: cache },
      { type: 'text', text: layer4 },
    ],
  };

  return [systemMessage, userMessage];
}
