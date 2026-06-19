// POST /api/v1/subscription/portal (§9, §8) — create a Stripe Customer Portal
// Session for self-serve subscription management.
//
// Web-only. Fixed 200 { url }, so it uses createRoute. The Stripe SDK requires the
// Node runtime, so the segment config pins `runtime = 'nodejs'`. The client is
// constructed here and injected into the pure ../operations builder (mockable in
// the unit test). The customer id is looked up from the subscriptions row; a user
// who never checked out gets a 409 from the operation.
import Stripe from 'stripe';
import { ApiError, ErrorCode, createRoute } from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { createPortalSession } from '../operations';
import type { StripeUrlResponse } from '../schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = createRoute<StripeUrlResponse>(async ({ user }) => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new ApiError(ErrorCode.INTERNAL_ERROR, 'STRIPE_SECRET_KEY is not configured.');
  }
  const stripe = new Stripe(secretKey);
  return createPortalSession(stripe, createDrizzleClient(), user.id);
});
