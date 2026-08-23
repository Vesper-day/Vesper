// POST /api/v1/plans/week/generate (Chat 058) — weekly-template synthesis.
//
// Runs the seven-day Sonnet synthesis (with the Step-4 transient constraints) and
// returns the reviewable week as JSON. GENERATE-ONLY: it persists nothing — the
// separate accept route batch-writes the reviewed week. Node runtime is required
// (@vesper/ai -> @vesper/db is postgres-js, Node-only; the weekly call is not edge-safe).
//
// NEW ENDPOINT (flagged): no existing surface runs weekly synthesis; the daily
// /plans/generate route synthesizes ONE day and persists it, so it does not fit.
// Core logic lives in the sibling ../operations module.
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
import { runWeekGeneration } from '../operations';

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
    const data = await runWeekGeneration(createDrizzleClient(), user.id, raw);

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
      extra: { method: request.method, path: '/api/v1/plans/week/generate', userId },
    });
    const response = errorResponse(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}
