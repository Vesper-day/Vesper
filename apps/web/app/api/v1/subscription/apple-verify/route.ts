// POST /api/v1/subscription/apple-verify (§9) — 501 STUB this chat.
//
// The full StoreKit 2 JWS verification + subscription upsert lands chat 086
// (PHASE_4_BUILD_PLAN L1125,L1132); this chat ships only the route shell so the
// path exists and the request Zod is in place for 086 to reuse. It returns the §9
// error envelope { error: { code, message } } with code NOT_IMPLEMENTED at HTTP
// 501 — NOT a 200 — so a client (and the type system downstream) sees the
// not-yet-implemented contract explicitly rather than a silent success.
//
// createRoute is unusable (it emits a fixed 200), so this uses the manual
// auth/version-gate/error wrapper. The body is validated even though the handler
// stubs out, so 086 inherits the request contract { jwsTransaction } verbatim.
import * as Sentry from '@sentry/nextjs';
import {
  ApiError,
  ErrorCode,
  errorResponse,
  validateSession,
  checkAppVersion,
} from '@vesper/shared';
import { AppleVerifyRequestSchema } from '../schemas';

const REQUEST_ID_HEADER = 'X-Request-Id';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  let userId: string | undefined;

  try {
    checkAppVersion(request);
    const user = await validateSession(request);
    userId = user.id;

    const raw: unknown = await request.json().catch(() => null);
    const parsed = AppleVerifyRequestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError(
        ErrorCode.INVALID_REQUEST,
        'Request body must be { jwsTransaction: string }.',
      );
    }

    // Not implemented until chat 086 (StoreKit 2 verification).
    const response = errorResponse(
      ErrorCode.NOT_IMPLEMENTED,
      'Apple receipt verification is not yet available.',
      501,
    );
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
      extra: { method: request.method, path: '/api/v1/subscription/apple-verify', userId },
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
