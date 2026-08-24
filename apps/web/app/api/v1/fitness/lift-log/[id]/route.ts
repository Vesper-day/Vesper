// DELETE /api/v1/fitness/lift-log/[id] — hard-delete a lift-log entry (204, empty body).
//
// DELETE returns 204 with an empty body, which createRoute (200 + JSON body) cannot
// express, so it uses the custom auth/version-gate/error wrapper — the same pattern
// nutrition/food-log/[id]/route.ts uses. A non-UUID id or an absent / not-owned row maps
// to 404 NOT_FOUND (own-row RLS + the ../../operations guard). The body's user_id is
// NEVER trusted. Core logic lives in the sibling ../../operations module.
import * as Sentry from '@sentry/nextjs';
import {
  ApiError,
  ErrorCode,
  errorResponse,
  validateSession,
  checkAppVersion,
} from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { deleteLiftLogEntry } from '../../operations';

const REQUEST_ID_HEADER = 'X-Request-Id';

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
    await deleteLiftLogEntry(createDrizzleClient(), user.id, params.id);

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
      extra: { method: request.method, path: '/api/v1/fitness/lift-log/[id]', userId },
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
