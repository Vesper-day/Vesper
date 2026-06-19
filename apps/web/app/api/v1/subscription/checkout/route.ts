// POST /api/v1/subscription/checkout (§9, §8) — create a Stripe Checkout Session.
//
// Web-only conversion flow. Fixed 200 { url }, so it uses createRoute (auth +
// version-gate + §9 error mapping). The Stripe SDK requires the Node runtime
// (not Edge), so the segment config pins `runtime = 'nodejs'`. The Stripe client
// is constructed here and injected into the pure ../operations builder so the
// unit test can pass a mock. STRIPE_SECRET_KEY / STRIPE_PRICE_ID come from env
// (ENVIRONMENT_SETUP §); the price is never hardcoded (§8).
import Stripe from 'stripe';
import { ApiError, ErrorCode, createRoute } from '@vesper/shared';
import { createCheckoutSession } from '../operations';
import type { StripeUrlResponse } from '../schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = createRoute<StripeUrlResponse>(async ({ user }) => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new ApiError(ErrorCode.INTERNAL_ERROR, 'STRIPE_SECRET_KEY is not configured.');
  }
  const stripe = new Stripe(secretKey);
  return createCheckoutSession(stripe, { userId: user.id, email: user.email });
});
