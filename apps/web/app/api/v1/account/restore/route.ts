// POST /api/v1/account/restore (§9, §4 Phase 2) — cancel a pending deletion.
//
// §9 response is a bare 200 with NO body, which createRoute (which always
// JSON-serializes a body) cannot express, so this uses the manual
// auth/version-gate/error wrapper (same split tasks DELETE uses) and returns an
// empty 200. Core UPDATE lives in ../operations.restoreAccount.
import * as Sentry from '@sentry/nextjs';
import {
  ApiError,
  ErrorCode,
  errorResponse,
  validateSession,
  checkAppVersion,
} from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { restoreAccount } from '../operations';

const REQUEST_ID_HEADER = 'X-Request-Id';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  let userId: string | undefined;

  try {
    checkAppVersion(request);
    const user = await validateSession(request);
    userId = user.id;

    await restoreAccount(createDrizzleClient(), user.id);

    const response = new Response(null, { status: 200 });
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
      extra: { method: request.method, path: '/api/v1/account/restore', userId },
    });
    const response = errorResponse(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}
