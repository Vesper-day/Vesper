// GET  /api/v1/calendar-events?start=ISO&end=ISO — list the user's events as
//   concrete instances within the window (recurring rows expanded on read).
// POST /api/v1/calendar-events                    — create one event (201).
//
// GET returns a fixed 200 → createRoute (auth + version-gate + §9 error mapping).
// POST returns 201, which createRoute (hardcoded 200) cannot express, so it uses
// the custom auth/version-gate/error wrapper — exactly as tasks/blocks do for
// their 201 POST. Core logic lives in the sibling ./operations module (a route.ts
// may export only HTTP-method handlers + segment config).
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
import {
  listCalendarEvents,
  createCalendarEvent,
  type CalendarEventListResponse,
} from './operations';

const REQUEST_ID_HEADER = 'X-Request-Id';

export const dynamic = 'force-dynamic';

export const GET = createRoute<CalendarEventListResponse>(async ({ user, request }) => {
  const params = new URL(request.url).searchParams;
  return listCalendarEvents(
    createDrizzleClient(),
    user.id,
    params.get('start'),
    params.get('end'),
  );
});

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  let userId: string | undefined;

  try {
    checkAppVersion(request);
    const user = await validateSession(request);
    userId = user.id;

    const body: unknown = await request.json().catch(() => null);
    const data = await createCalendarEvent(createDrizzleClient(), user.id, body);

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
      extra: { method: request.method, path: '/api/v1/calendar-events', userId },
    });
    const response = errorResponse(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}
