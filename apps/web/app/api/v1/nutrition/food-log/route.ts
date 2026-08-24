// GET  /api/v1/nutrition/food-log  — the user's food-log entries for their current
//   local day, newest first (200).
// POST /api/v1/nutrition/food-log  — create a food-log entry (201).
//
// GET returns a fixed 200, so it uses createRoute (auth + version-gate + §9 error
// mapping); the local-day boundary comes from the authed user's timezone (mirrors
// plans/today). POST returns 201, which createRoute (hardcoded 200) cannot express, so
// it uses the custom auth/version-gate/error wrapper — exactly as medications/route.ts
// does. Core logic lives in the sibling ../operations module.
import * as Sentry from '@sentry/nextjs';
import {
  ApiError,
  ErrorCode,
  errorResponse,
  successResponse,
  validateSession,
  checkAppVersion,
  createRoute,
} from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import type { FoodLogListResponse } from '@vesper/shared/nutrition';
import { listTodayFoodLog, createFoodLogEntry } from '../operations';

const REQUEST_ID_HEADER = 'X-Request-Id';

export const GET = createRoute<FoodLogListResponse>(async ({ user }) =>
  listTodayFoodLog(createDrizzleClient(), user.id, user.timezone),
);

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  let userId: string | undefined;

  try {
    checkAppVersion(request);
    const user = await validateSession(request);
    userId = user.id;

    const body: unknown = await request.json().catch(() => null);
    const data = await createFoodLogEntry(createDrizzleClient(), user.id, body);

    const response = successResponse(data, 201);
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
      extra: { method: request.method, path: '/api/v1/nutrition/food-log', userId },
    });
    const response = errorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      500,
    );
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}
