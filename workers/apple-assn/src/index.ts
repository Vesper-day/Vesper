// workers/apple-assn — Apple App Store Server Notifications V2 receiver (Chat 087 part 1,
// EXTENDED by Chat 088 part 2 — the SAME worker, not a fork).
//
// HTTP `fetch` worker (NOT scheduled/cron, NOT part of the consolidated daily-cron
// shell — that worker is scheduled-only; an HTTP webhook is its own worker, mirroring
// the 084 workers/stripe-webhook sibling). Apple POSTs `{ signedPayload }`; this worker
// verifies the outer ASSN V2 envelope JWS AND the inner signed transaction JWS against
// the pinned Apple Root CA - G3, idempotently records the event, row-locks the
// subscription via the §8 state machine, dispatches every handled notification type, and
// enqueues a 5-minute reconcile on every real mutation.
//
// HANDLED TYPES — part 1 (five): SUBSCRIBED, DID_RENEW, EXPIRED, REVOKE, REFUND.
// Part 2 (ten + TEST): DID_FAIL_TO_RENEW, GRACE_PERIOD_EXPIRED, RENEWAL_EXTENDED,
// DID_CHANGE_RENEWAL_STATUS, REFUND_REVERSED, PRICE_INCREASE, OFFER_REDEEMED,
// REFUND_DECLINED, DID_CHANGE_RENEWAL_PREF, TEST. The (notificationType, subtype) →
// action decision lives ENTIRELY in ./dispatch.ts (pure, offline-tested); this file only
// EXECUTES the descriptor. Unknown types remain audit-only 200.
//
// TEST IS A FAST PATH — App Store Connect rejects a slow webhook URL, so a TEST probe
// audit-logs and returns immediately: NO user lookup, NO row lock, NO transition, NO
// reconcile enqueue.
//
// MUTATION KINDS — a "real mutation" is a status transition OR a period-window update
// (DID_RENEW / RENEWAL_EXTENDED) OR a cancel_at_period_end flag write
// (DID_CHANGE_RENEWAL_STATUS). ALL THREE advance last_event_at and enqueue the reconcile.
//
// SCOPE FLAG — DID_CHANGE_RENEWAL_PREF is audit-only here. TECHNICAL_SPEC §Payments links
// it to a referral_credits → 'applied' write; referral_credits is outside this worker's
// subscription-state scope and is deliberately NOT written here (left unowned — see
// ./dispatch.ts).
//
// JWS VERIFY REUSE — the security-critical x5c-chain verify is imported from the shared
// @vesper/apple package (extracted from apps/web/lib/apple in THIS chat), so apps/web
// and this worker share ONE implementation with no drift-prone hand-duplicate. The
// OUTER envelope carries notificationType/subtype/signedDate (verified with the generic
// verifyAppleJws — no transaction-field assertion); the INNER data.signedTransactionInfo
// carries the transaction (verified with verifyAppleTransactionJws). BOTH are verified:
// trusting notificationType requires the outer signature; trusting the txn requires the
// inner signature. NO JWKS lookup, NO appleid.apple.com/auth/keys, NO shared webhook
// secret (Apple's signature IS the trust anchor).
//
// SCHEMA ACCESS — RAW parameterized SQL through the canonical Postgres client for ALL
// subscriptions / subscription_events / delayed_jobs I/O (the subscriptions Drizzle
// model is known-stale). Timestamps bind as ISO strings + ::timestamptz — postgres.js
// cannot serialize a JS Date through the Drizzle sql`` param path.
//
// IMPORT — the state machine is pulled via the @vesper/shared/subscriptionState subpath
// (NOT the package barrel, which re-exports realtime/api-auth/react-email surfaces that
// would bloat/break this worker bundle).
//
// DEPLOY/TRANSPORT ARE CUTOVER CONCERNS — a real Sentry DSN, the wrangler deploy, the
// Postgres binding, and the App Store Connect webhook URL are set at Cutover; the worker
// is inert until then. Sentry is mocked in tests (the local DSN no-ops).
import { createDrizzleClient, sql, type Database } from '@vesper/db';
import {
  transitionToActive as realTransitionToActive,
  transitionToPastDue as realTransitionToPastDue,
  transitionToReadOnly as realTransitionToReadOnly,
  IllegalSubscriptionTransitionError,
} from '@vesper/shared/subscriptionState';
import {
  verifyAppleJws as realVerifyAppleJws,
  verifyAppleTransactionJws as realVerifyAppleTransactionJws,
  type AppleTransactionPayload,
} from '@vesper/apple';
import * as Sentry from '@sentry/nextjs';
import {
  mapNotificationToTransition,
  isMutation,
  type AssnTransitionDescriptor,
} from './dispatch';

/** Minimal structural types for the Workers fetch API (avoids a workers-types dep). */
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}
type Env = Record<string, string | undefined>;

/** The subset of the ASSN V2 responseBodyV2DecodedPayload this worker relies on. */
interface AssnV2DecodedPayload {
  notificationType?: string;
  subtype?: string;
  notificationUUID?: string;
  signedDate?: number; // epoch ms
  data?: {
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * The state-machine fns this worker dispatches to (injectable for tests). Chat 088 adds
 * transitionToPastDue for the §8 DID_FAIL_TO_RENEW mapping.
 */
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

/** The two JWS verifiers this worker uses (injectable for tests — no real fixtures needed). */
export interface VerifyFns {
  /** Outer envelope: generic chain-verify, returns the decoded notification payload. */
  verifyEnvelope(jws: string): Promise<Record<string, unknown>>;
  /** Inner data.signedTransactionInfo: chain-verify + transaction-field assertion. */
  verifyTransaction(jws: string): Promise<AppleTransactionPayload>;
}

const DEFAULT_VERIFY: VerifyFns = {
  verifyEnvelope: (jws) => realVerifyAppleJws(jws),
  verifyTransaction: (jws) => realVerifyAppleTransactionJws(jws),
};

export interface AssnDeps {
  db: Database;
  /** Defaults to the real @vesper/shared transitions; overridden in unit tests. */
  transitions?: TransitionFns;
  /** Defaults to the real @vesper/apple verifiers; overridden in unit tests. */
  verify?: VerifyFns;
  /** Defaults to Sentry.captureException; overridden in unit tests. */
  captureException?: (err: unknown) => void;
}

interface SubscriptionLookupRow {
  user_id: string;
  status: string;
  last_event_at: string | Date | null;
}

/** Grace on the monotonic-ordering guard: clock skew + Apple's multi-day retry window. */
const ORDERING_GRACE_MS = 24 * 60 * 60 * 1000;

function ok(outcome: string): Response {
  return new Response(JSON.stringify({ received: true, outcome }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Durably record the inbound notification (the FIRST half of the record-then-check-
 * processed_at idempotency shape — committed BEFORE any transition). Returns the
 * RETURNING rows: non-empty ⇒ a fresh insert; EMPTY ⇒ (provider, event_id) already
 * present, and the caller re-reads processed_at to tell a true replay from an
 * interrupted attempt. `userId` is null for a no-user event and for the TEST probe.
 */
function recordEvent(
  db: Database,
  eventId: string,
  notificationType: string,
  userId: string | null,
  auditPayload: string,
): Promise<Array<{ id: string }>> {
  return db.execute(sql`
    INSERT INTO subscription_events (provider, event_id, event_type, user_id, payload)
    VALUES (
      'apple'::payment_source_enum,
      ${eventId},
      ${notificationType},
      ${userId}::uuid,
      ${auditPayload}::jsonb
    )
    ON CONFLICT (provider, event_id) DO NOTHING
    RETURNING id
  `) as unknown as Promise<Array<{ id: string }>>;
}

async function markProcessed(db: Database, eventId: string): Promise<void> {
  await db.execute(sql`
    UPDATE subscription_events
    SET processed_at = now()
    WHERE provider = 'apple'::payment_source_enum AND event_id = ${eventId}
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
    WHERE provider = 'apple'::payment_source_enum AND event_id = ${eventId}
  `);
}

/** Apple epoch-milliseconds → ISO-8601 string (or null when the field is absent). */
function epochMsToIso(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined) return null;
  return new Date(ms).toISOString();
}

/**
 * Core ASSN V2 handler — pure of the Workers env wiring (deps injected). Returns the
 * HTTP Response the worker sends back to Apple.
 *
 * Flow: parse `{ signedPayload }` → verify the OUTER envelope JWS (400 on bad sig, no
 * DB) → verify the INNER signedTransactionInfo JWS (400 on bad sig, no DB) → map the
 * type to a descriptor (pure, ./dispatch.ts) → TEST fast path (audit + 200, nothing
 * else) → resolve userId + current row via the apple_original_transaction_id lookup →
 * idempotency record (086 shape: record-then-check-processed_at) → no-user / audit-only
 * / monotonic-stale short-circuits → period-window update (DID_RENEW / RENEWAL_EXTENDED)
 * → cancel_at_period_end flag write (DID_CHANGE_RENEWAL_STATUS) → transition in its own
 * SELECT … FOR UPDATE txn (already-in-target guard; illegal-source → audit 200) →
 * advance last_event_at (+ canceled_at on REFUND / cleared on REFUND_REVERSED) → enqueue
 * the 5-minute reconcile → mark processed → 200. Only a genuinely-unexpected error →
 * Sentry + 500 (Apple retries).
 */
export async function handleAppleAssn(
  request: Request,
  deps: AssnDeps,
): Promise<Response> {
  const { db } = deps;
  const verify = deps.verify ?? DEFAULT_VERIFY;
  const fns = deps.transitions ?? DEFAULT_FNS;
  const capture = deps.captureException ?? ((err: unknown) => Sentry.captureException(err));

  // Parse the POST body. ASSN V2 delivers `{ "signedPayload": "<compact JWS>" }`.
  let signedPayload: string;
  try {
    const body = (await request.json()) as { signedPayload?: unknown };
    if (typeof body?.signedPayload !== 'string' || body.signedPayload.length === 0) {
      return new Response('Missing signedPayload', { status: 400 });
    }
    signedPayload = body.signedPayload;
  } catch {
    return new Response('Malformed request body', { status: 400 });
  }

  // Verify the OUTER envelope. A bad/tampered signature is a 400 — NO DB touch.
  let envelope: AssnV2DecodedPayload;
  try {
    envelope = (await verify.verifyEnvelope(signedPayload)) as AssnV2DecodedPayload;
  } catch {
    return new Response('Invalid ASSN V2 signature', { status: 400 });
  }

  const notificationType = envelope.notificationType;
  const subtype = envelope.subtype;
  const signedDate = typeof envelope.signedDate === 'number' ? envelope.signedDate : undefined;
  if (!notificationType) {
    return new Response('Missing notificationType', { status: 400 });
  }

  // Verify the INNER signed transaction (when present). A bad inner signature is a
  // 400 — NO DB touch. Absent inner info is only expected for unhandled types.
  let txn: AppleTransactionPayload | null = null;
  const innerJws = envelope.data?.signedTransactionInfo;
  if (typeof innerJws === 'string' && innerJws.length > 0) {
    try {
      txn = await verify.verifyTransaction(innerJws);
    } catch {
      return new Response('Invalid signed transaction', { status: 400 });
    }
  }

  // event_id (§8 composite): originalTransactionId + '_' + notificationType + '_' +
  // signedDate. This is the ASSN form (NOT a bare notificationUUID, NOT 086's
  // transaction form). The (provider, event_id) UNIQUE is the SOLE replay protection —
  // no timestamp rejection (Apple retries for days). A txn-less unhandled envelope
  // (audit-only path) has no originalTransactionId; it falls back to notificationUUID so
  // it is still idempotently auditable.
  const eventId = txn
    ? `${txn.originalTransactionId}_${notificationType}_${signedDate ?? 'na'}`
    : `${envelope.notificationUUID ?? signedDate ?? 'na'}_${notificationType}`;

  // Resolve the action BEFORE any I/O — the mapping is pure (./dispatch.ts).
  const descriptor: AssnTransitionDescriptor = mapNotificationToTransition(
    notificationType,
    subtype,
  );
  const auditPayload = JSON.stringify({ notification: envelope, transaction: txn });

  try {
    // TEST — App Store Connect's reachability probe. FAST PATH: audit-log the event and
    // return 200 immediately. NO user lookup, NO SELECT … FOR UPDATE, NO transition, NO
    // reconcile enqueue — App Store Connect rejects a webhook URL that answers slowly,
    // and a probe carries no subscription state to act on. Two statements, both
    // idempotent (the ON CONFLICT insert + a markProcessed that re-marks harmlessly).
    if (descriptor.kind === 'test') {
      await recordEvent(db, eventId, notificationType, null, auditPayload);
      await markProcessed(db, eventId);
      return ok('test');
    }

    // Resolve userId + current locked-read fields via the apple_original_transaction_id
    // row (subscription_events.user_id is nullable for Apple events that arrive before
    // the client apple-verify path has created the row). Raw SQL — never the stale model.
    let sub: SubscriptionLookupRow | null = null;
    if (txn) {
      const rows = (await db.execute(sql`
        SELECT user_id, status, last_event_at
        FROM subscriptions
        WHERE apple_original_transaction_id = ${txn.originalTransactionId}
        LIMIT 1
      `)) as unknown as SubscriptionLookupRow[];
      sub = rows[0] ?? null;
    }
    const userId = sub?.user_id ?? null;

    // Idempotency (086 record-then-check-processed_at shape). Record the event
    // (committed) BEFORE the transition. ON CONFLICT ⇒ already recorded — re-read
    // processed_at: SET ⇒ true replay (return, no re-process); NULL ⇒ a prior attempt
    // died mid-flow ⇒ fall through and RE-PROCESS (idempotent writes + guarded
    // transition). A bare DO NOTHING → 200 (084's Stripe shape) would strand a
    // mid-flow-interrupted Apple event as a permanent false-replay.
    const inserted = await recordEvent(db, eventId, notificationType, userId, auditPayload);

    if (inserted.length === 0) {
      const prior = (await db.execute(sql`
        SELECT processed_at FROM subscription_events
        WHERE provider = 'apple'::payment_source_enum AND event_id = ${eventId}
        LIMIT 1
      `)) as unknown as Array<{ processed_at: Date | string | null }>;
      if (prior[0]?.processed_at != null) {
        return ok('duplicate'); // fully processed ⇒ true replay, no re-transition.
      }
      // recorded-but-unprocessed ⇒ a prior attempt died mid-flow ⇒ re-process.
    }

    // Unresolvable user (no apple_original_transaction_id row yet — the ASSN arrived
    // before the client apple-verify path created the row): durably audited above,
    // nothing to transition → 200. The 5-min reconcile + later events converge state.
    if (!userId || !sub) {
      await markProcessed(db, eventId);
      return ok('no-user');
    }

    // Audit-only type (PRICE_INCREASE / OFFER_REDEEMED / REFUND_DECLINED /
    // DID_CHANGE_RENEWAL_PREF / a subtype-less DID_CHANGE_RENEWAL_STATUS, or an unknown
    // type): recorded, no transition, no period or flag write → 200.
    if (!isMutation(descriptor)) {
      await markProcessed(db, eventId);
      return ok('no-transition');
    }

    // Monotonic-ordering guard: an ASSN older than last_event_at - 24h is a stale /
    // out-of-order retry that would regress state. Audit it, skip the mutation, 200.
    if (signedDate !== undefined && sub.last_event_at) {
      const lastMs = new Date(sub.last_event_at).getTime();
      if (signedDate < lastMs - ORDERING_GRACE_MS) {
        await markProcessed(db, eventId);
        return ok('stale');
      }
    }

    // DID_RENEW / RENEWAL_EXTENDED — advance the period window from the inner
    // transaction only, NO status transition. Both carry the authoritative new window on
    // the inner signed transaction (RENEWAL_EXTENDED pushes expiresDate out), so both
    // take this identical write. A real mutation → advances last_event_at + enqueues the
    // reconcile.
    if (descriptor.updatePeriod) {
      const periodStart = epochMsToIso(txn?.purchaseDate);
      const periodEnd = epochMsToIso(txn?.expiresDate);
      await db.execute(sql`
        UPDATE subscriptions
        SET current_period_start = ${periodStart}::timestamptz,
            current_period_end = ${periodEnd}::timestamptz,
            updated_at = now()
        WHERE user_id = ${userId}::uuid
      `);
      await advanceLastEventAt(db, userId, signedDate);
      await enqueueReconcile(db, userId);
      await markProcessed(db, eventId);
      return ok('renew');
    }

    // DID_CHANGE_RENEWAL_STATUS — flip cancel_at_period_end only (true ⇐
    // AUTO_RENEW_DISABLED, false ⇐ AUTO_RENEW_ENABLED), NO status transition: the
    // subscription remains active through the period already paid for, and its eventual
    // lapse arrives as its own EXPIRED. This IS a real mutation, so it advances
    // last_event_at and enqueues the reconcile exactly like the period-window path.
    if (descriptor.setCancelAtPeriodEnd !== null) {
      await db.execute(sql`
        UPDATE subscriptions
        SET cancel_at_period_end = ${descriptor.setCancelAtPeriodEnd}, updated_at = now()
        WHERE user_id = ${userId}::uuid
      `);
      await advanceLastEventAt(db, userId, signedDate);
      await enqueueReconcile(db, userId);
      await markProcessed(db, eventId);
      return ok('renewal-status');
    }

    // A transitioning type (SUBSCRIBED / REFUND_REVERSED → active; DID_FAIL_TO_RENEW →
    // past_due; EXPIRED/REVOKE/REFUND/GRACE_PERIOD_EXPIRED → read_only).
    const target = descriptor.kind; // 'active' | 'past_due' | 'read_only'

    // Already-in-target guard: pre-read the status and SKIP when current == target.
    // transitionToActive is NOT legal from 'active' (a SUBSCRIBED replay/re-verify) and
    // transitionToReadOnly is NOT legal from 'read_only' — so a naive call would throw
    // on the idempotent case. The state machine re-locks + re-validates in its own txn,
    // so this pre-read is a fast-path, not the authority.
    if (sub.status === target) {
      await markProcessed(db, eventId);
      return ok('already-in-target');
    }

    // Dispatch the transition — each opens its own SELECT … FOR UPDATE txn in
    // @vesper/shared. A genuinely-illegal source (e.g. REFUND→read_only when the row is
    // already 'archived') throws IllegalSubscriptionTransitionError: audit it with the
    // error and 200 (durably recorded; we do NOT want Apple retrying a permanently-
    // illegal delivery for days). A non-transition error (infra) propagates → 5xx.
    try {
      if (target === 'active') await fns.transitionToActive(db, userId);
      else if (target === 'past_due') await fns.transitionToPastDue(db, userId);
      else await fns.transitionToReadOnly(db, userId);
    } catch (err) {
      if (err instanceof IllegalSubscriptionTransitionError) {
        await markProcessedError(db, eventId, err.message);
        return ok('illegal-transition');
      }
      throw err;
    }

    // Advance last_event_at (ordering-guard basis for the next delivery), then the
    // canceled_at side-writes: SET on REFUND, CLEARED on REFUND_REVERSED (the refund
    // that set it was undone, so the field must not outlive it). The frozen
    // fn(db, userId) owns its own txn and cannot take these extra writes, so they run as
    // raw UPDATEs immediately after; the 24h grace absorbs the small non-atomic window.
    await advanceLastEventAt(db, userId, signedDate);
    if (descriptor.setCanceledAt) {
      const canceledIso = epochMsToIso(signedDate) ?? new Date().toISOString();
      await db.execute(sql`
        UPDATE subscriptions
        SET canceled_at = ${canceledIso}::timestamptz, updated_at = now()
        WHERE user_id = ${userId}::uuid
      `);
    }
    if (descriptor.clearCanceledAt) {
      await db.execute(sql`
        UPDATE subscriptions
        SET canceled_at = NULL, updated_at = now()
        WHERE user_id = ${userId}::uuid
      `);
    }

    await enqueueReconcile(db, userId);
    await markProcessed(db, eventId);
    return ok('ok');
  } catch (err) {
    // Genuinely-unexpected (infra) error: log to Sentry and 500 so Apple retries. A
    // handled IllegalSubscriptionTransitionError never reaches here (audited inline).
    capture(err);
    return new Response('Internal error', { status: 500 });
  }
}

/** Advance last_event_at to the inbound event's signedDate (ms), or now() if absent. */
async function advanceLastEventAt(
  db: Database,
  userId: string,
  signedDate: number | undefined,
): Promise<void> {
  const iso = epochMsToIso(signedDate) ?? new Date().toISOString();
  await db.execute(sql`
    UPDATE subscriptions
    SET last_event_at = ${iso}::timestamptz, updated_at = now()
    WHERE user_id = ${userId}::uuid
  `);
}

/**
 * 5-minute reconcile job for the affected user. INERT until the chat-074 tick worker
 * consumes delayed_jobs; enqueued here so state is reconciled shortly after any
 * webhook-driven change (mirrors the 084 Stripe worker).
 */
async function enqueueReconcile(db: Database, userId: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO delayed_jobs (job_type, payload, scheduled_for)
    VALUES (
      'reconcile_subscription',
      jsonb_build_object('userId', ${userId}::text),
      now() + interval '5 minutes'
    )
  `);
}

export default {
  async fetch(
    request: Request,
    _env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    return handleAppleAssn(request, { db: createDrizzleClient() });
  },
};
