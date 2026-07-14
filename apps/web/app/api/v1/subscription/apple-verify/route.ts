// POST /api/v1/subscription/apple-verify (§9, §8) — verify a StoreKit 2 signed
// transaction and activate the Apple subscription. Mobile-only conversion path.
//
// Lifted from the chat-030 501 stub: the full StoreKit 2 JWS verification +
// subscriptions upsert now lands here. Success is a fixed 200 (the §9 subscription
// state), so this uses createRoute (auth via the injected `user` + version-gate +
// §9 error map + X-Request-Id) — the stub could not, because it returned 501.
//
// The JWS is verified via ../../../../lib/apple/jws (x5c-chain verification against a
// PINNED Apple root — NOT a JWKS lookup, and NO per-call Apple network fetch). The
// subscription upsert + transition live in the pure ../operations builder so the unit
// test can inject mocks. runtime='nodejs' — node:crypto + jose need Node, not Edge.
//
// The server does NOT finish the StoreKit transaction; the client finishes it on a
// verified 200 so an unverified purchase is never dropped from the StoreKit queue.
import { ApiError, ErrorCode, createRoute } from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { verifyAppleTransaction } from '../operations';
import { AppleVerifyRequestSchema, type SubscriptionResponse } from '../schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = createRoute<SubscriptionResponse>(async ({ request, user }) => {
  const raw: unknown = await request.json().catch(() => null);
  const parsed = AppleVerifyRequestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      'Request body must be { jwsTransaction: string }.',
    );
  }

  return verifyAppleTransaction(createDrizzleClient(), {
    userId: user.id,
    jwsTransaction: parsed.data.jwsTransaction,
  });
});
