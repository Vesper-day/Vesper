// POST /api/v1/internal/auth-event (PHASE_4_BUILD_PLAN L1130) — INTERNAL endpoint.
//
// Not a §9 public route: it is authenticated by a SHARED SECRET header
// (`x-auth-event-secret`), NOT a Bearer session, because its callers are
// server-side / database-side, not end users:
//   - the auth.users UPDATE trigger (migration 20260601000023) via pg_net, and
//   - the server-side onAuthStateChange hook (apps/web/lib/auth/onAuthStateChange.ts).
//
// Action: DELETE all push_tokens rows for the given user_id, so a signed-out /
// password-changed / session-expired / hard-deleted device stops receiving pushes.
//
// Auth: the secret is compared against AUTH_EVENT_SECRET. A missing/wrong header
// is 401 UNAUTHORIZED — and a missing SERVER secret is treated as 401 too (fail
// closed: never accept an unauthenticated call just because the server is
// misconfigured). Comparison is constant-time to avoid a timing oracle.
//
// SCHEMA SOURCE — RAW SQL: the push_tokens ORM model (integrations.ts) is STALE vs
// migration 20260601000007 (missing live_activity_token / last_used_at, wrong
// uniqueness), so the delete runs as raw parameterized SQL scoped by user_id.
import * as Sentry from '@sentry/nextjs';
import { ApiError, ErrorCode, errorResponse, successResponse } from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { AuthEventRequestSchema } from './schemas';
import { deletePushTokensForUser } from './operations';

const REQUEST_ID_HEADER = 'X-Request-Id';
const SECRET_HEADER = 'x-auth-event-secret';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    requireSharedSecret(request);

    const raw: unknown = await request.json().catch(() => null);
    const parsed = AuthEventRequestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError(
        ErrorCode.INVALID_REQUEST,
        'Request body must be { userId: uuid, eventType }.',
      );
    }

    const deleted = await deletePushTokensForUser(
      createDrizzleClient(),
      parsed.data.userId,
    );

    const response = successResponse({ deleted });
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
      extra: { method: request.method, path: '/api/v1/internal/auth-event' },
    });
    const response = errorResponse(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}

/** Throw UNAUTHORIZED unless the request carries the correct shared secret. */
function requireSharedSecret(request: Request): void {
  const expected = process.env.AUTH_EVENT_SECRET;
  const provided = request.headers.get(SECRET_HEADER);
  // Fail closed: no server secret ⇒ reject (never accept an unauthenticated call).
  if (!expected || !provided || !timingSafeEqual(provided, expected)) {
    throw new ApiError(ErrorCode.UNAUTHORIZED, 'Invalid auth-event secret.');
  }
}

/** Constant-time string compare (length-independent) to avoid a timing oracle. */
function timingSafeEqual(a: string, b: string): boolean {
  let mismatch = a.length === b.length ? 0 : 1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
