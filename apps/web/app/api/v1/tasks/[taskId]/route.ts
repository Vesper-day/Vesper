// PATCH /api/v1/tasks/[taskId]  — partial-update a task (200).
// DELETE /api/v1/tasks/[taskId] — hard-delete a task (204, empty body).
//
// PATCH returns a fixed 200, so it uses createRoute (which supplies the auth user,
// awaits params, and maps ApiError -> the §9 error shape). DELETE returns 204 with
// an empty body, which createRoute (200 + JSON body) cannot express, so it uses the
// custom auth/version-gate/error wrapper — the same split blocks uses between its
// createRoute PATCH and custom POST. Core logic lives in the sibling ../operations
// module (a route.ts may export only HTTP-method handlers + segment config).
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
import { updateTask, deleteTask, type TaskResponse } from '../operations';

const REQUEST_ID_HEADER = 'X-Request-Id';

export const PATCH = createRoute<TaskResponse>(async ({ user, request, params }) => {
  const body: unknown = await request.json().catch(() => null);
  return updateTask(createDrizzleClient(), user.id, params.taskId, body);
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
    await deleteTask(createDrizzleClient(), user.id, params.taskId);

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
      extra: { method: request.method, path: '/api/v1/tasks/[taskId]', userId },
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
