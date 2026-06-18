// POST /api/v1/blocks (§9) — create a user-added block under an existing plan,
// guarded by a plan-level optimistic-concurrency check.
//
// Unlike the GET/PATCH routes this is a CUSTOM handler (not createRoute) because
// a successful create returns 201, while an idempotent replay of the same
// clientMutationId returns 200 — and createRoute hardcodes 200. The auth /
// version-gate / error-mapping boilerplate mirrors plans/generate's route.
//
// Core logic lives in the sibling ./operations module (a route.ts may export
// only HTTP-method handlers + segment config); the integration tests drive
// createUserBlock directly against the local test DB.
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
import { createUserBlock } from './operations';

const REQUEST_ID_HEADER = 'X-Request-Id';

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  let userId: string | undefined;

  try {
    checkAppVersion(request);
    const user = await validateSession(request);
    userId = user.id;

    const body: unknown = await request.json().catch(() => null);
    const { response: data, created } = await createUserBlock(
      createDrizzleClient(),
      user.id,
      body,
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
      extra: { method: request.method, path: '/api/v1/blocks', userId },
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
