// GET /api/v1/subscription (§9) — the authenticated user's subscription state.
//
// Fixed 200, so it uses createRoute (auth + version-gate + §9 error mapping),
// exactly as referral/code's GET does. Core read lives in the sibling
// ./operations module (a route.ts may export only HTTP handlers + segment config).
import { createRoute } from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { getSubscription } from './operations';
import type { SubscriptionResponse } from './schemas';

export const GET = createRoute<SubscriptionResponse>(async ({ user }) => {
  return getSubscription(createDrizzleClient(), user.id);
});
