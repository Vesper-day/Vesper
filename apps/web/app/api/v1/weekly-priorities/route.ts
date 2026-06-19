// GET + PUT /api/v1/weekly-priorities (§9).
//
// GET → 200 → createRoute (fixed-200 success wrapper). Optional ?weekStart=
// YYYY-MM-DD; defaults to the current Monday-anchored week.
//
// PUT → create-or-replace. §9 allows 200 or 201; we return 201 on insert and 200
// on replace (the push-tokens / blocks 201-vs-200 precedent), which createRoute's
// fixed 200 cannot express — hence the manual wrapper for PUT. NOT rate-limited
// (weekly-priorities is absent from the RATE_LIMITING.md matcher).
//
// Core logic lives in the sibling ./operations module (a route.ts may export only
// HTTP-method handlers + segment config).
import * as Sentry from '@sentry/nextjs';
import {
  createRoute,
  ApiError,
  ErrorCode,
  errorResponse,
  successResponse,
  validateSession,
  checkAppVersion,
} from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { getWeeklyPriorities, putWeeklyPriorities } from './operations';
import { WeekStartQuerySchema, type WeeklyPrioritiesResponse } from './schemas';

const REQUEST_ID_HEADER = 'X-Request-Id';

export const GET = createRoute<WeeklyPrioritiesResponse>(async ({ request, user }) => {
  const rawWeekStart = new URL(request.url).searchParams.get('weekStart') ?? undefined;
  const parsed = WeekStartQuerySchema.safeParse(rawWeekStart);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      'Query param weekStart must be a YYYY-MM-DD date.',
    );
  }
  return getWeeklyPriorities(createDrizzleClient(), user.id, parsed.data);
});

export async function PUT(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  let userId: string | undefined;

  try {
    checkAppVersion(request);
    const user = await validateSession(request);
    userId = user.id;

    const raw: unknown = await request.json().catch(() => null);
    const { response: data, created } = await putWeeklyPriorities(
      createDrizzleClient(),
      user.id,
      raw,
    );

    const response = successResponse(data, created ? 201 : 200);
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
      extra: { method: request.method, path: '/api/v1/weekly-priorities', userId },
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
