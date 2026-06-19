// POST /api/v1/push-tokens (§9) — register or update a device's push token.
//
// Returns 201 on insert, 200 on update — a variable status createRoute (fixed 200)
// cannot express, so this uses the manual auth/version-gate/error wrapper (same
// split tasks/blocks use for their 201 POST). The upsert + insert-vs-update
// detection live in the sibling ./operations module.
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
import { PushTokenRequestSchema } from './schemas';
import { upsertPushToken } from './operations';

const REQUEST_ID_HEADER = 'X-Request-Id';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  let userId: string | undefined;

  try {
    checkAppVersion(request);
    const user = await validateSession(request);
    userId = user.id;

    const raw: unknown = await request.json().catch(() => null);
    const parsed = PushTokenRequestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError(
        ErrorCode.INVALID_REQUEST,
        'Request body must be { deviceId, platform, token, liveActivityToken? }.',
      );
    }

    const { data, created } = await upsertPushToken(
      createDrizzleClient(),
      user.id,
      parsed.data,
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
      extra: { method: request.method, path: '/api/v1/push-tokens', userId },
    });
    const response = errorResponse(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}
