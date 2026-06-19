// POST /api/v1/ai/command (§9) — parse a natural-language command into a
// structured plan edit + butler-tone confirmation line.
//
// RATE LIMITED (RATE_LIMITING.md, limiter `ai-command`, 60 / 1h per user). The
// manual wrapper (not createRoute) is used for the same reason plans/generate
// uses it: a 429 must carry a `Retry-After` header, which createRoute's fixed
// success/error mapping cannot set. On success this returns a plain 200 (no
// 201/204), matching the §9 shape.
//
// Core logic lives in the sibling ./operations module (a route.ts may export only
// HTTP-method handlers + segment config). The integration test drives runAiCommand
// directly with the parser + limiter mocked, so it needs neither an Anthropic key
// nor Upstash env.
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
import { runAiCommand } from './operations';

const REQUEST_ID_HEADER = 'X-Request-Id';

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  let userId: string | undefined;

  try {
    checkAppVersion(request);
    const user = await validateSession(request);
    userId = user.id;

    // Per-user rate limit BEFORE any parsing/model work (429 short-circuits).
    await withRateLimit('ai-command', user.id);

    const raw: unknown = await request.json().catch(() => null);
    const data = await runAiCommand(raw);

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
      extra: { method: request.method, path: '/api/v1/ai/command', userId },
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
