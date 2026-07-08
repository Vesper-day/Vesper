// PATCH /api/v1/medications/[id]  — partial-update a medication (200).
// DELETE /api/v1/medications/[id] — hard-delete a medication (204, empty body).
//
// PATCH returns a fixed 200, so it uses createRoute (which supplies the auth user,
// awaits params, and maps ApiError -> the §9 error shape). DELETE returns 204 with
// an empty body, which createRoute (200 + JSON body) cannot express, so it uses the
// custom auth/version-gate/error wrapper — the same split tasks uses between its
// createRoute PATCH and custom DELETE. A non-UUID id or an absent / not-owned row
// maps to 404 NOT_FOUND. The body's user_id is NEVER trusted. Core logic lives in
// the sibling ../operations module.
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
import { updateMedication, deleteMedication, type MedicationResponse } from '../operations';

const REQUEST_ID_HEADER = 'X-Request-Id';

export const PATCH = createRoute<MedicationResponse>(async ({ user, request, params }) => {
  const body: unknown = await request.json().catch(() => null);
  return updateMedication(createDrizzleClient(), user.id, params.id, body);
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
    await deleteMedication(createDrizzleClient(), user.id, params.id);

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
      extra: { method: request.method, path: '/api/v1/medications/[id]', userId },
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
