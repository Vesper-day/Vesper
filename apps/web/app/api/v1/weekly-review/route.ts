// GET /api/v1/weekly-review[?weekStart=YYYY-MM-DD] (Chat 057 — DECISION A).
//
// A thin authenticated read returning the prior-week block-completion counts + rate
// for the step-1 review of the Sunday weekly-planning session. Fixed 200 → createRoute
// (auth + version-gate + §9 error mapping). ?weekStart is the TARGET planning week's
// Monday (surfaces pass the coming Monday); the reviewed window is the week before it.
//
// Core logic lives in the sibling ./operations module (a route.ts may export only
// HTTP-method handlers + segment config). NOT rate-limited (weekly, low-frequency;
// absent from the RATE_LIMITING.md matcher).
import { z } from 'zod';
import { createRoute, ApiError, ErrorCode } from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { getPriorWeekCompletion, type WeeklyReviewResponse } from './operations';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const WeekStartQuerySchema = z.string().regex(DATE_REGEX).optional();

export const GET = createRoute<WeeklyReviewResponse>(async ({ request, user }) => {
  const rawWeekStart = new URL(request.url).searchParams.get('weekStart') ?? undefined;
  const parsed = WeekStartQuerySchema.safeParse(rawWeekStart);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      'Query param weekStart must be a YYYY-MM-DD date.',
    );
  }
  return getPriorWeekCompletion(createDrizzleClient(), user.id, parsed.data);
});
