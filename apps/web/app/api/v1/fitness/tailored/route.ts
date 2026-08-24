// POST /api/v1/fitness/tailored — tailored workout generation, REUSING the chat-049
//   selection/adaptation path verbatim (buildTemplateSubset / filterWorkouts +
//   selectWorkoutTemplate). Returns the single selected workout (or `{ workout: null }`
//   when the prefs filter the corpus to no candidate). This is a generation that returns
//   200 (not a resource creation), so createRoute (auth + version-gate + §9 error
//   mapping + 200) fits. Core logic lives in the sibling ../operations module.
import { createRoute } from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import type { TailoredWorkoutResponse } from '@vesper/shared/fitness';
import { generateTailoredWorkout } from '../operations';

export const POST = createRoute<TailoredWorkoutResponse>(async ({ request, user }) => {
  const body: unknown = await request.json().catch(() => null);
  return generateTailoredWorkout(createDrizzleClient(), user.id, body);
});
