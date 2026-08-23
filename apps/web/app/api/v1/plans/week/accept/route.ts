// POST /api/v1/plans/week/accept (Chat 058) — batch-write the reviewed week.
//
// Persists the seven reviewed days to daily_plans + blocks by REUSING the daily
// persist path (commitPlan) once per day: each day's daily_plans row is upserted in
// place on UNIQUE(user_id, plan_date) and its blocks are deleted before the new ones
// are inserted (§3.3 write semantics). On success the client returns to the day view
// with the week loaded. Node runtime is required (@vesper/db is postgres-js).
//
// NEW ENDPOINT (flagged): the batch-write on accept takes a CLIENT-provided reviewed
// week; the daily /plans/generate route synthesizes and persists server-side and does
// not accept a plan body, so no existing surface fits. Core logic lives in the sibling
// ../operations module (commitWeek, the shared batch-write seam).
import * as Sentry from '@sentry/nextjs';
import {
  ApiError,
  ErrorCode,
  errorResponse,
  successResponse,
  validateSession,
  checkAppVersion,
} from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { acceptWeek } from '../operations';

export const runtime = 'nodejs';

const REQUEST_ID_HEADER = 'X-Request-Id';

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  let userId: string | undefined;

  try {
    checkAppVersion(request);
    const user = await validateSession(request);
    userId = user.id;

    const raw: unknown = await request.json().catch(() => null);
    const data = await acceptWeek(createDrizzleClient(), user.id, user.timezone, raw);

    const response = successResponse(data, 200);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  } catch (err) {
    if (err instanceof ApiError) {
      const response = errorResponse(err.code, err.message, err.httpStatus);
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    }
    Sentry.captureException(err, {
      tags: { requestId },
      extra: { method: request.method, path: '/api/v1/plans/week/accept', userId },
    });
    const response = errorResponse(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}
