// POST /api/v1/account/delete (§9, §4 Phase 1) — initiate account deletion.
//
// Fixed 200 { deletionScheduledAt, hardDeleteAt }, so it uses createRoute (auth +
// version-gate + §9 error mapping). The canonical DB writes + synchronous Stripe
// cancel live in ../operations.deleteAccount. After that commits, §4 requires the
// user be signed out and the session invalidated — done here as BEST-EFFORT side
// effects (push-token cleanup via onAuthStateChange('sign-out'); they must not fail
// the already-recorded deletion). The Stripe SDK + admin work need the Node runtime.
import Stripe from 'stripe';
import { createRoute } from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { onAuthStateChange } from '../../../../../lib/auth/onAuthStateChange';
import { deleteAccount, type DeleteAccountResponse } from '../operations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = createRoute<DeleteAccountResponse>(async ({ user }) => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const stripe = secretKey ? new Stripe(secretKey) : null;

  const result = await deleteAccount(createDrizzleClient(), stripe, user.id);

  // Sign-out side effect: clear the user's push tokens so their devices stop
  // receiving notifications. Best-effort — deletion is already recorded.
  await onAuthStateChange({ userId: user.id, eventType: 'sign-out' });

  return result;
});
