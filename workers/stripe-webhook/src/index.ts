// workers/stripe-webhook — Stripe webhook receiver (Chat 084).
//
// Verifies the raw-body Stripe signature, then dispatches six subscription event
// types to the canonical §8 state machine (@vesper/shared/subscriptionState) inside
// per-row-locked transactions, enforcing idempotency and monotonic ordering, and
// enqueues a 5-minute reconcile job. Per-worker Cloudflare Worker (Decision 20's
// consolidated cron shell is scheduled-only; an HTTP webhook is its own worker).
//
// SCHEMA ACCESS — RAW parameterized SQL through the canonical Postgres client for
// ALL subscriptions / subscription_events / delayed_jobs I/O. The subscriptions
// Drizzle model is known-stale (omits provider/status/stripe_customer_id/+more), so
// this handler never touches the ORM model — it mirrors the chat-083 portal
// precedent (apps/web/app/api/v1/subscription/operations.ts) exactly.
//
// SIGNATURE — Stripe.webhooks.constructEvent(raw, sig, secret, tolerance) on the RAW
// body BEFORE any JSON parse; a mismatch is a 400. tolerance = 31536000s (one year)
// is deliberate: the SDK default (300s) silently drops Stripe's multi-day retries.
// NOTE: stripe@14 takes tolerance as a POSITIONAL NUMBER (verified in the installed
// types/Webhooks.d.ts) — not the `{ tolerance }` object shape; the positional form
// carries the same one-year intent.
//
// IMPORT — the state machine is pulled via the @vesper/shared/subscriptionState
// subpath (added to the package exports map in this chat), NOT the package barrel:
// the barrel statically re-exports realtime / api-auth / react-email surfaces that
// would bloat (or break) this worker bundle. The subpath pulls only @vesper/db,
// which the worker needs anyway (mirrors the 038 ./queries subpath rationale).
import Stripe from 'stripe';
import { createDrizzleClient, sql, type Database } from '@vesper/db';
import {
  transitionToActive as realTransitionToActive,
  transitionToPastDue as realTransitionToPastDue,
  transitionToReadOnly as realTransitionToReadOnly,
  IllegalSubscriptionTransitionError,
} from '@vesper/shared/subscriptionState';
import { mapEventToTransition } from './dispatch';

/** Minimal structural types for the Workers fetch API (avoids a workers-types dep). */
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}
interface Env {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

/** One year in seconds — the deliberate signature tolerance (see file header). */
export const SIGNATURE_TOLERANCE_SECONDS = 31536000;

/** The three state-machine fns this handler dispatches to (injectable for tests). */
export interface TransitionFns {
  transitionToActive(db: Database, userId: string): Promise<void>;
  transitionToPastDue(db: Database, userId: string): Promise<void>;
  transitionToReadOnly(db: Database, userId: string): Promise<void>;
}

const DEFAULT_FNS: TransitionFns = {
  transitionToActive: realTransitionToActive,
  transitionToPastDue: realTransitionToPastDue,
  transitionToReadOnly: realTransitionToReadOnly,
};

/** Just the surface of the Stripe client this handler uses (mockable in tests). */
export interface StripeVerifier {
  webhooks: Pick<Stripe['webhooks'], 'constructEvent'>;
}

export interface WebhookDeps {
  db: Database;
  stripe: StripeVerifier;
  webhookSecret: string;
  /** Defaults to the real @vesper/shared transitions; overridden in unit tests. */
  transitions?: TransitionFns;
}

interface SubscriptionLookupRow {
  user_id: string;
  status: string;
  last_event_at: string | Date | null;
}

/** Grace on the monotonic-ordering guard: clock skew + Stripe retry window. */
const ORDERING_GRACE_MS = 24 * 60 * 60 * 1000;

interface ExtractedIds {
  customerId: string | null;
  subscriptionId: string | null;
  objectStatus: string | undefined;
}

/** Pull the customer / subscription ids + object status off the event object. */
function extractIds(event: Stripe.Event): ExtractedIds {
  const obj = event.data.object as Record<string, unknown>;
  const customerId = typeof obj.customer === 'string' ? obj.customer : null;

  if (event.type.startsWith('customer.subscription.')) {
    return {
      customerId,
      subscriptionId: typeof obj.id === 'string' ? obj.id : null,
      objectStatus: typeof obj.status === 'string' ? obj.status : undefined,
    };
  }
  if (event.type.startsWith('invoice.')) {
    return {
      customerId,
      subscriptionId:
        typeof obj.subscription === 'string' ? obj.subscription : null,
      objectStatus: undefined,
    };
  }
  return { customerId, subscriptionId: null, objectStatus: undefined };
}

function ok(outcome: string): Response {
  return new Response(JSON.stringify({ received: true, outcome }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function markProcessed(db: Database, eventId: string): Promise<void> {
  await db.execute(sql`
    UPDATE subscription_events
    SET processed_at = now()
    WHERE provider = 'stripe'::payment_source_enum AND event_id = ${eventId}
  `);
}

async function markProcessedError(
  db: Database,
  eventId: string,
  message: string,
): Promise<void> {
  await db.execute(sql`
    UPDATE subscription_events
    SET processed_at = now(), processing_error = ${message}
    WHERE provider = 'stripe'::payment_source_enum AND event_id = ${eventId}
  `);
}

/**
 * Core webhook handler — pure of the Workers env wiring (deps injected). Returns the
 * HTTP Response the worker sends back to Stripe.
 *
 * Flow: raw-body signature verify (400 on mismatch) -> resolve userId + current row
 * via subscriptions lookup (raw SQL) -> idempotency INSERT ... ON CONFLICT DO NOTHING
 * (replay -> 200, no re-process) -> trial_will_end sets pending_trial_reminder (no
 * transition) -> monotonic-ordering guard (older than last_event_at - 24h -> audit +
 * 200) -> already-in-target guard (current == target -> audit + 200) -> transition in
 * its own row-locked txn -> advance last_event_at (+ canceled_at on cancel/delete) ->
 * enqueue the 5-minute reconcile job.
 */
export async function handleStripeWebhook(
  request: Request,
  deps: WebhookDeps,
): Promise<Response> {
  const { db, stripe, webhookSecret } = deps;
  const fns = deps.transitions ?? DEFAULT_FNS;

  const sig = request.headers.get('stripe-signature') ?? '';
  const raw = await request.text(); // RAW body — verify BEFORE any JSON parse.

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      raw,
      sig,
      webhookSecret,
      SIGNATURE_TOLERANCE_SECONDS,
    );
  } catch {
    return new Response('Invalid Stripe signature', { status: 400 });
  }

  const { customerId, subscriptionId, objectStatus } = extractIds(event);

  // Resolve userId + the current locked-read fields via the subscriptions row. Raw
  // SQL against the migration-008 columns (never the stale Drizzle model).
  const rows = (await db.execute(sql`
    SELECT user_id, status, last_event_at
    FROM subscriptions
    WHERE (${subscriptionId}::text IS NOT NULL AND stripe_subscription_id = ${subscriptionId})
       OR (${customerId}::text IS NOT NULL AND stripe_customer_id = ${customerId})
    LIMIT 1
  `)) as unknown as SubscriptionLookupRow[];
  const sub = rows[0] ?? null;
  const userId = sub?.user_id ?? null;

  // Idempotency claim: the (provider, event_id) UNIQUE is THE dedup key. A conflict
  // (zero returned rows) means we already processed this event -> 200, no re-process.
  const claimed = (await db.execute(sql`
    INSERT INTO subscription_events (provider, event_id, event_type, user_id, payload)
    VALUES (
      'stripe'::payment_source_enum,
      ${event.id},
      ${event.type},
      ${userId}::uuid,
      ${JSON.stringify(event)}::jsonb
    )
    ON CONFLICT (provider, event_id) DO NOTHING
    RETURNING id
  `)) as unknown as Array<{ id: string }>;
  if (claimed.length === 0) {
    return ok('duplicate');
  }

  const descriptor = mapEventToTransition(event.type, objectStatus);

  // Unresolvable user (no subscriptions row matched customer/subscription id): the
  // event is durably audited above; there is nothing to transition -> 200.
  if (!userId || !sub) {
    await markProcessed(db, event.id);
    return ok('no-user');
  }

  // trial_will_end: no state change. Set the redundancy flag the chat-072 trial
  // reminder reads, audit, 200.
  if (descriptor.kind === 'trial_reminder') {
    await db.execute(sql`
      UPDATE subscriptions
      SET pending_trial_reminder = true, updated_at = now()
      WHERE user_id = ${userId}::uuid
    `);
    await markProcessed(db, event.id);
    return ok('trial-reminder');
  }

  // Non-transitioning event (e.g. updated with an unhandled status) — audit-only.
  if (!descriptor.transitions) {
    await markProcessed(db, event.id);
    return ok('no-transition');
  }

  // Monotonic-ordering guard: a delivery older than last_event_at - 24h is a stale /
  // out-of-order retry that would regress state. Audit it, skip the transition, 200.
  const eventCreated = event.created; // unix seconds
  if (sub.last_event_at) {
    const lastMs = new Date(sub.last_event_at).getTime();
    if (eventCreated * 1000 < lastMs - ORDERING_GRACE_MS) {
      await markProcessed(db, event.id);
      return ok('stale');
    }
  }

  // Already-in-target guard (determination: choice (a) — pre-read the status and skip
  // when current == target). A healthy renewal (invoice.payment_succeeded while
  // 'active') is NOT a legal §8 source for transitionToActive, so a naive call throws
  // on normal traffic; skipping here keeps it an idempotent audit-only no-op. Combined
  // with idempotency (replay) + the ordering guard (out-of-order), no path can drive a
  // regression transition. The state machine re-locks + re-validates in its own txn,
  // so this pre-read is a fast-path, not the authority.
  const target = descriptor.kind; // 'active' | 'past_due' | 'read_only'
  if (sub.status === target) {
    await markProcessed(db, event.id);
    return ok('already-in-target');
  }

  // Dispatch the transition — each opens its own SELECT ... FOR UPDATE txn in
  // @vesper/shared. A genuinely-illegal source (current != target but still not a
  // legal edge) throws IllegalSubscriptionTransitionError: audit it with the error and
  // 200 (durably recorded; the 5-min reconcile + monotonic ordering are the safety
  // net — we do not want Stripe retrying a permanently-illegal delivery for days). A
  // non-transition error (infra) propagates -> 5xx -> Stripe retries.
  try {
    if (target === 'active') await fns.transitionToActive(db, userId);
    else if (target === 'past_due') await fns.transitionToPastDue(db, userId);
    else await fns.transitionToReadOnly(db, userId);
  } catch (err) {
    if (err instanceof IllegalSubscriptionTransitionError) {
      await markProcessedError(db, event.id, err.message);
      return ok('illegal-transition');
    }
    throw err;
  }

  // Advance last_event_at to the inbound event time (ordering guard basis for the next
  // delivery). The frozen fn(db, userId) owns its own txn and cannot take these extra
  // writes, so they run as raw UPDATEs immediately after the transition commits; the
  // 24h ordering grace absorbs the small non-atomic window.
  await db.execute(sql`
    UPDATE subscriptions
    SET last_event_at = to_timestamp(${eventCreated}), updated_at = now()
    WHERE user_id = ${userId}::uuid
  `);
  if (descriptor.setCanceledAt) {
    await db.execute(sql`
      UPDATE subscriptions
      SET canceled_at = to_timestamp(${eventCreated}), updated_at = now()
      WHERE user_id = ${userId}::uuid
    `);
  }

  // 5-minute reconcile job for the affected user. INERT until the chat-074 tick worker
  // lands (nothing consumes delayed_jobs yet); enqueued here so state is reconciled
  // shortly after any webhook-driven change.
  await db.execute(sql`
    INSERT INTO delayed_jobs (job_type, payload, scheduled_for)
    VALUES (
      'reconcile_subscription',
      jsonb_build_object('userId', ${userId}::text),
      now() + interval '5 minutes'
    )
  `);

  await markProcessed(db, event.id);
  return ok('ok');
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    const secretKey = env.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
    const webhookSecret =
      env.STRIPE_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET;
    if (!secretKey || !webhookSecret) {
      return new Response('Stripe is not configured', { status: 500 });
    }
    const stripe = new Stripe(secretKey);
    return handleStripeWebhook(request, {
      db: createDrizzleClient(),
      stripe,
      webhookSecret,
    });
  },
};
