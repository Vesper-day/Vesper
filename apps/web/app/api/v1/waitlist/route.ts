// POST /api/v1/waitlist (§9) — UNAUTHENTICATED pre-launch email capture.
//
// Public marketing endpoint (no Bearer token, no app-version gate). Rate limiting
// lives in apps/web/middleware.ts (limiter `waitlist`, 100/1h per anonymous IP
// hash), NOT here (chat 009 / RATE_LIMITING.md).
//
// createRoute is unusable: it requires an authenticated session and returns a
// fixed 200. §9 needs 201 on success and 409 on duplicate, so this mirrors the
// chat-024 energy route's manual wrapper (requestId → Zod → handler → response),
// minus the session/version gates. Core insert lives in ./addToWaitlist (a
// route.ts file may export only HTTP handlers + segment config).
import * as Sentry from '@sentry/nextjs';
import {
  ApiError,
  ErrorCode,
  successResponse,
  errorResponse,
} from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { WaitlistRequestSchema } from './schemas';
import { addToWaitlist } from './addToWaitlist';

const REQUEST_ID_HEADER = 'X-Request-Id';

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    const raw: unknown = await request.json().catch(() => null);
    const parsed = WaitlistRequestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError(
        ErrorCode.INVALID_REQUEST,
        'Request body must be { email, platformPreference: "ios" | "android" }.',
      );
    }

    const data = await addToWaitlist(createDrizzleClient(), parsed.data);
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
      extra: { method: request.method, path: '/api/v1/waitlist' },
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
