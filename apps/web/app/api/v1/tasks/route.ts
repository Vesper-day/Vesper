// GET /api/v1/tasks  — list the user's tasks (priority DESC, deadline ASC).
// POST /api/v1/tasks — create a task (201).
//
// GET returns a fixed 200, so it uses createRoute (auth + version-gate + §9 error
// mapping). POST returns 201, which createRoute (hardcoded 200) cannot express, so
// it uses the custom auth/version-gate/error wrapper — exactly as blocks/route.ts
// does for its 201 POST. Core logic lives in the sibling ./operations module (a
// route.ts may export only HTTP-method handlers + segment config).
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
import { listTasks, createTask, type TaskListResponse } from './operations';

const REQUEST_ID_HEADER = 'X-Request-Id';

export const GET = createRoute<TaskListResponse>(async ({ user, request }) => {
  const status = new URL(request.url).searchParams.get('status');
  return listTasks(createDrizzleClient(), user.id, status);
});

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  let userId: string | undefined;

  try {
    checkAppVersion(request);
    const user = await validateSession(request);
    userId = user.id;

    const body: unknown = await request.json().catch(() => null);
    const data = await createTask(createDrizzleClient(), user.id, body);

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
      extra: { method: request.method, path: '/api/v1/tasks', userId },
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
