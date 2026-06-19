// POST /api/v1/plans/date/[date]/reorder (build-plan Chat 029).
//
// ROUTE PATH (flagged): the build plan literally names `plans/[date]/reorder`, but
// the established convention nests date-scoped plan routes under `plans/date/[date]/`
// (see the existing GET plans/date/[date]/route.ts). This route follows that
// convention, so the path is `plans/date/[date]/reorder`.
//
// Returns 200 on success and maps OCC conflicts to 409 via ApiError, so the fixed
// 200 createRoute wrapper fits (no 201/204, not rate-limited). [date] is validated
// as strict YYYY-MM-DD per the chat-024 param-validation convention, reusing
// isValidPlanDate from plans/operations. Core logic lives in the sibling
// ./operations module.
import { createRoute, ApiError, ErrorCode } from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { isValidPlanDate } from '../../../operations';
import { reorderBlocks } from './operations';
import type { ReorderResponse } from './schemas';

export const POST = createRoute<ReorderResponse>(async ({ request, user, params }) => {
  const dateParam = params.date;
  if (typeof dateParam !== 'string' || !isValidPlanDate(dateParam)) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      'Path parameter [date] must be a valid YYYY-MM-DD date.',
    );
  }
  const raw: unknown = await request.json().catch(() => null);
  return reorderBlocks(createDrizzleClient(), user.id, dateParam, raw);
});
