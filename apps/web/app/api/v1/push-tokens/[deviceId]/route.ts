// DELETE /api/v1/push-tokens/[deviceId] (§9) — remove a device's push token
// (called on sign-out).
//
// Returns 204 with an empty body, which createRoute (200 + JSON body) cannot
// express, so it uses the manual auth/version-gate/error wrapper (same split tasks
// DELETE uses). The delete is scoped to the authed user AND the device id; a
// missing row is not an error (idempotent 204). Core logic lives in ../operations.
import * as Sentry from '@sentry/nextjs';
import {
  ApiError,
  ErrorCode,
  errorResponse,
  validateSession,
  checkAppVersion,
} from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { deletePushToken } from '../operations';

const REQUEST_ID_HEADER = 'X-Request-Id';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  context: { params: Promise<Record<string, string | string[]>> },
): Promise<Response> {
  const requestId = crypto.randomUUID();
  let userId: string | undefined;

  try {
    checkAppVersion(request);
    const user = await validateSession(request);
    userId = user.id;

    const params = (await context?.params) ?? {};
    const deviceId = Array.isArray(params.deviceId) ? params.deviceId[0] : params.deviceId;
    if (!deviceId) {
      throw new ApiError(ErrorCode.INVALID_REQUEST, 'Missing deviceId path parameter.');
    }

    await deletePushToken(createDrizzleClient(), user.id, deviceId);

    const response = new Response(null, { status: 204 });
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
      extra: { method: request.method, path: '/api/v1/push-tokens/[deviceId]', userId },
    });
    const response = errorResponse(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}
