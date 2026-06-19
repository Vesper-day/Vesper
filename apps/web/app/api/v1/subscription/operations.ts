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

// --- helpers -----------------------------------------------------------------

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
