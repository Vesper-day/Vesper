// GET /api/v1/fitness/workouts — the workout-schedule list: the 047/048
//   workout_templates corpus filtered to the user's fitness prefs via the chat-049
//   selection path (buildTemplateSubset / filterWorkouts). Fixed 200, so it uses
//   createRoute (auth + version-gate + §9 error mapping). Returns an empty list when the
//   fitness module is off. Core logic lives in the sibling ../operations module.
import {
  createRoute,
} from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import type { WorkoutScheduleResponse } from '@vesper/shared/fitness';
import { listWorkoutSchedule } from '../operations';

export const GET = createRoute<WorkoutScheduleResponse>(async ({ user }) =>
  listWorkoutSchedule(createDrizzleClient(), user.id),
);
