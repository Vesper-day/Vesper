// Subscription DB-layer + Stripe-session core logic (§9 "Subscriptions"), shared
// by the route handlers. A route.ts may export ONLY HTTP-method handlers + segment
// config, so the pure functions live here (mirrors tasks/operations.ts).
//
// SCHEMA SOURCE — RAW SQL (not the ORM model):
// The Drizzle `subscriptions` model (packages/db/src/schema/subscriptions.ts) is
// STALE vs the applied migration 20260601000008: the stub omits `provider`,
// `status`, `stripe_price_id`, `apple_product_id`, `canceled_at`,
// `cancellation_reason`, `cancellation_reason_text`. GET /subscription needs
// `status` + `provider`, which the model does not carry — so the read runs as raw
// parameterized SQL against the migration columns (the read-side analog of
// withUser, scoped by an explicit user_id), pending the chat-006 drizzle-kit pull.
// Mirrors the waitlist/referral_credits raw-SQL precedent (CHAT_111 §5).
//
// STRIPE — the session builders take a `Stripe` client as a parameter (rather than
// constructing it) so the unit tests can pass a mock without module mocking; the
// route handlers construct `new Stripe(STRIPE_SECRET_KEY)` and inject it.
import type Stripe from 'stripe';
import { sql, type Database } from '@vesper/db';
import { ApiError, ErrorCode } from '@vesper/shared';
import {
  transitionToActive,
  IllegalSubscriptionTransitionError,
} from '@vesper/shared/subscriptionState';
import { verifyAppleTransactionJws, type AppleTransactionPayload } from '@/lib/apple/jws';
import type { SubscriptionResponse, StripeUrlResponse } from './schemas';

interface SubscriptionRow {
  status: string;
  provider: string;
  current_period_end: string | Date | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
}

/**
 * GET /api/v1/subscription — the authenticated user's current subscription state.
 *
 * No subscriptions row yet (user still on the pre-checkout trial) is a valid
 * state: §9 always returns a `subscription` object, so we synthesize a `trial`
 * shape from the absence of a row rather than 404-ing. The denormalized
 * `users.subscription_status` is the authoritative trial signal, but this handler
 * is scoped to the subscriptions table; an absent row ⇒ never-subscribed ⇒ trial.
 */
export async function getSubscription(
  db: Database,
  userId: string,
): Promise<SubscriptionResponse> {
  const rows = (await db.execute(sql`
    SELECT status, provider, current_period_end, cancel_at_period_end,
           stripe_customer_id
    FROM subscriptions
    WHERE user_id = ${userId}::uuid
    LIMIT 1
  `)) as unknown as SubscriptionRow[];

  const row = rows[0];
  if (!row) {
    // No billing row — user is on the internally-managed trial (§8).
    return {
      subscription: {
        status: 'trial',
        provider: 'none',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
    };
  }

  return {
    subscription: {
      status: row.status,
      provider: row.provider,
      currentPeriodEnd: toIso(row.current_period_end),
      cancelAtPeriodEnd: row.cancel_at_period_end,
    },
  };
}

/**
 * POST /api/v1/subscription/checkout — create a Stripe Checkout Session (§8).
 *
 * Session params are verbatim §8: subscription mode, the env-configured price
 * (never hardcoded), the user's email, the vesper_user_id metadata the webhook
 * keys on, automatic tax, and no Stripe-managed trial (Vesper owns trial state).
 */
export async function createCheckoutSession(
  stripe: Stripe,
  args: { userId: string; email: string },
): Promise<StripeUrlResponse> {
  const priceId = requireEnv('STRIPE_PRICE_ID');
  const baseUrl = appBaseUrl();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: args.email,
    metadata: { vesper_user_id: args.userId },
    success_url: `${baseUrl}/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/settings/billing`,
    automatic_tax: { enabled: true },
    subscription_data: { trial_period_days: 0 },
  });

  if (!session.url) {
    throw new ApiError(
      ErrorCode.INTEGRATION_ERROR,
      'Stripe did not return a Checkout URL.',
    );
  }
  return { url: session.url };
}

/**
 * POST /api/v1/subscription/portal — create a Stripe Customer Portal Session (§8).
 *
 * Requires an existing Stripe customer: the portal manages an active
 * subscription, so a user with no `stripe_customer_id` (never checked out) gets a
 * 409 rather than a Stripe error. `return_url` is the billing settings page (§8).
 */
export async function createPortalSession(
  stripe: Stripe,
  db: Database,
  userId: string,
): Promise<StripeUrlResponse> {
  const rows = (await db.execute(sql`
    SELECT stripe_customer_id
    FROM subscriptions
    WHERE user_id = ${userId}::uuid
    LIMIT 1
  `)) as unknown as Array<{ stripe_customer_id: string | null }>;

  const customerId = rows[0]?.stripe_customer_id;
  if (!customerId) {
    throw new ApiError(
      ErrorCode.CONFLICT,
      'No Stripe customer for this account. Subscribe before opening the billing portal.',
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appBaseUrl()}/settings/billing`,
  });

  return { url: session.url };
}

/**
 * POST /api/v1/subscription/apple-verify — verify a StoreKit 2 signed transaction
 * and activate the Apple subscription (§8, §9). Mobile-only conversion path.
 *
 * Injected deps (`verifyJws`, `activate`) default to the real implementations so the
 * route wires nothing, while tests pass mocks WITHOUT module mocking (mirrors the
 * Stripe-client injection in createCheckoutSession/createPortalSession).
 *
 * Flow: verify JWS → idempotency-record the transaction → UPSERT the apple row →
 * transition to active (guarded) → return the §9 subscription state. The server does
 * NOT finish the StoreKit transaction — the client finishes it on a verified 200.
 *
 * ALL subscriptions / subscription_events I/O is raw parameterized SQL: the Drizzle
 * `subscriptions` model is KNOWN-STALE vs migration 000008 (mirrors getSubscription
 * / the 084 webhook handler).
 */
export interface AppleVerifyDeps {
  verifyJws?: (jws: string) => Promise<AppleTransactionPayload>;
  activate?: (db: Database, userId: string) => Promise<void>;
}

export async function verifyAppleTransaction(
  db: Database,
  args: { userId: string; jwsTransaction: string },
  deps: AppleVerifyDeps = {},
): Promise<SubscriptionResponse> {
  const verifyJws = deps.verifyJws ?? verifyAppleTransactionJws;
  const activate = deps.activate ?? transitionToActive;
  const { userId, jwsTransaction } = args;

  // 1. Verify the StoreKit 2 JWS (x5c chain → pinned Apple root → leaf key). A
  //    tampered / malformed / pin-mismatch token is a typed 400, never a pass.
  let txn: AppleTransactionPayload;
  try {
    txn = await verifyJws(jwsTransaction);
  } catch {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      'Could not verify the App Store transaction.',
    );
  }

  // event_id for a StoreKit TRANSACTION (no notificationType/signedDate as the
  // §8 App Store Server Notification form has): originalTransactionId + '_' +
  // transactionId. Stable across re-posts of the same transaction, so the
  // (provider, event_id) UNIQUE constraint fires the idempotency path on replay.
  const eventId = `${txn.originalTransactionId}_${txn.transactionId}`;

  // 2. Idempotency FIRST: record the event. ON CONFLICT ⇒ this exact transaction was
  //    already verified ⇒ return current state WITHOUT re-transitioning.
  const inserted = (await db.execute(sql`
    INSERT INTO subscription_events (provider, event_id, event_type, user_id, payload)
    VALUES ('apple', ${eventId}, 'apple_storekit_verify', ${userId}::uuid,
            ${JSON.stringify(txn)}::jsonb)
    ON CONFLICT (provider, event_id) DO NOTHING
    RETURNING id
  `)) as unknown as Array<{ id: string }>;

  if (inserted.length === 0) {
    return getSubscription(db, userId);
  }

  // 3. UPSERT the subscriptions row (provider='apple', CHECK-compliant: apple id set,
  //    stripe ids NULL). On INSERT the row starts 'trial' so the transition below is a
  //    legal trial→active edge; on CONFLICT update the apple fields + periods, NULL the
  //    stripe identifiers (provider switch), and leave status untouched so an
  //    already-active row stays active for the guard in step 4.
  const periodStart = toDate(txn.purchaseDate);
  const periodEnd = toDate(txn.expiresDate);
  await db.execute(sql`
    INSERT INTO subscriptions
      (user_id, provider, status, apple_original_transaction_id, apple_product_id,
       current_period_start, current_period_end)
    VALUES
      (${userId}::uuid, 'apple', 'trial', ${txn.originalTransactionId},
       ${txn.productId}, ${periodStart}, ${periodEnd})
    ON CONFLICT (user_id) DO UPDATE SET
      provider = 'apple',
      apple_original_transaction_id = EXCLUDED.apple_original_transaction_id,
      apple_product_id = EXCLUDED.apple_product_id,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      stripe_customer_id = NULL,
      stripe_subscription_id = NULL,
      stripe_price_id = NULL,
      updated_at = now()
  `);

  // 4. Already-in-target guard. transitionToActive's legal sources are
  //    trial/past_due/read_only/archived — NOT active — so a re-verify of an
  //    already-active subscription is NOT a legal source and would throw. Pre-read the
  //    status and SKIP the transition (audit only) when already active; a replay /
  //    re-verify therefore never 5xx's.
  const stateRows = (await db.execute(sql`
    SELECT status FROM subscriptions WHERE user_id = ${userId}::uuid LIMIT 1
  `)) as unknown as Array<{ status: string }>;

  if (stateRows[0]?.status !== 'active') {
    try {
      await activate(db, userId);
    } catch (err) {
      // An illegal source (e.g. deletion_scheduled → active) is a typed 409, not a 500.
      if (err instanceof IllegalSubscriptionTransitionError) {
        throw new ApiError(
          ErrorCode.CONFLICT,
          'Subscription cannot be activated from its current state.',
        );
      }
      throw err;
    }
  }

  // 5. Mark the event processed (audit trail).
  await db.execute(sql`
    UPDATE subscription_events SET processed_at = now()
    WHERE provider = 'apple' AND event_id = ${eventId}
  `);

  return getSubscription(db, userId);
}

// --- helpers -----------------------------------------------------------------

/** Apple epoch-milliseconds → Date (or null when the field is absent). */
function toDate(ms: number | null | undefined): Date | null {
  if (ms === null || ms === undefined) return null;
  return new Date(ms);
}

function toIso(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ApiError(ErrorCode.INTERNAL_ERROR, `${name} is not configured.`);
  }
  return value;
}
