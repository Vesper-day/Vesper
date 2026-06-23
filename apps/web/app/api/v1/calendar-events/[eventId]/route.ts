// PATCH  /api/v1/calendar-events/[eventId] — partial-update one event.
// DELETE /api/v1/calendar-events/[eventId] — hard-delete one event (204).
//
// PATCH returns a fixed 200 → createRoute. DELETE returns 204 with an empty body,
// which createRoute (200 + JSON) cannot express, so it uses the custom
// auth/version-gate/error wrapper (same split tasks/push-tokens DELETE use). Both
// are scoped to the authed user AND the event id; core logic lives in
// ../operations.
import * as Sentry from '@sentry/nextjs';
import {
  ApiError,
  ErrorCode,
  errorResponse,
  validateSession,
  checkAppVersion,
  createRoute,
} from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import {
  updateCalendarEvent,
  deleteCalendarEvent,
  type CalendarEventResponse,
} from '../operations';

const REQUEST_ID_HEADER = 'X-Request-Id';

export const dynamic = 'force-dynamic';

export const PATCH = createRoute<CalendarEventResponse>(async ({ user, request, params }) => {
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
  const body: unknown = await request.json().catch(() => null);
  return updateCalendarEvent(createDrizzleClient(), user.id, eventId, body);
});

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
    const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
    if (!eventId) {
      throw new ApiError(ErrorCode.INVALID_REQUEST, 'Missing eventId path parameter.');
    }

    await deleteCalendarEvent(createDrizzleClient(), user.id, eventId);

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
      extra: { method: request.method, path: '/api/v1/calendar-events/[eventId]', userId },
    });
    const response = errorResponse(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}
