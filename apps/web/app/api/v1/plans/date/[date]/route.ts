// GET /api/v1/plans/date/[date] (§9).
//
// Returns the authenticated user's plan for an explicit [date] (any historical
// or future date). [date] is validated as strict YYYY-MM-DD (real calendar date)
// per the chat-024 param-validation convention; anything else → 400. Same
// (user_id, plan_date)-join-blocks read and same §9 shape as /plans/today.
// 404 (PLAN_NOT_FOUND) when no plan exists for that date.
//
// Core logic lives in the sibling ../../operations module (a route.ts may export
// only HTTP-method handlers + segment config).
import { createRoute, ApiError, ErrorCode } from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { getPlanForDate, isValidPlanDate, type PlanResponse } from '../../operations';

export const GET = createRoute<PlanResponse>(async ({ user, params }) => {
  const dateParam = params.date;
  if (typeof dateParam !== 'string' || !isValidPlanDate(dateParam)) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      'Path parameter [date] must be a valid YYYY-MM-DD date.',
    );
  }
  return getPlanForDate(createDrizzleClient(), user.id, dateParam);
});
