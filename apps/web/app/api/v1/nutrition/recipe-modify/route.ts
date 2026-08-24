// POST /api/v1/nutrition/recipe-modify — adjust a recipe to a requested change via the
// reused AI command infrastructure (@vesper/ai modifyRecipe), returning voice-gated
// butler text (200).
//
// RATE LIMITED (reuses the existing `ai-command` limiter — no new limiter row). The
// manual wrapper (not createRoute) is used for the same reason ai/command/route.ts uses
// it: a 429 must carry a `Retry-After` header, which createRoute's fixed success/error
// mapping cannot set. On success this returns a plain 200. Core logic lives in the
// sibling ../operations module (runRecipeModify); the Anthropic call is inside
// @vesper/ai and is mocked in every offline unit test.
import * as Sentry from '@sentry/nextjs';
import {
  ApiError,
  ErrorCode,
  RateLimitError,
  errorResponse,
  successResponse,
  validateSession,
  checkAppVersion,
  withRateLimit,
} from '@vesper/shared';
import { runRecipeModify } from '../operations';

const REQUEST_ID_HEADER = 'X-Request-Id';

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  let userId: string | undefined;

  try {
    checkAppVersion(request);
    const user = await validateSession(request);
    userId = user.id;

    // Per-user rate limit BEFORE any model work (429 short-circuits).
    await withRateLimit('ai-command', user.id);

    const raw: unknown = await request.json().catch(() => null);
    const data = await runRecipeModify(raw);

    const response = successResponse(data, 200);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  } catch (err) {
    if (err instanceof RateLimitError) {
      const response = errorResponse(err.code, err.message, err.httpStatus);
      response.headers.set(REQUEST_ID_HEADER, requestId);
      response.headers.set('Retry-After', String(err.retryAfterSeconds));
      return response;
    }
    if (err instanceof ApiError) {
      const response = errorResponse(err.code, err.message, err.httpStatus);
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    }
    Sentry.captureException(err, {
      tags: { requestId },
      extra: { method: request.method, path: '/api/v1/nutrition/recipe-modify', userId },
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
