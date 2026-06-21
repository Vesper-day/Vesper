// Canonical subscription state machine (TECHNICAL_SPEC §8).
//
// This is the ONE authoritative implementation of subscription transitions.
// Chat 030 shipped throwing stubs at apps/web/lib/subscription/stateMachine.ts
// (`transitionToActive` / `transitionToReadOnly`) purely as compile anchors; this
// module supersedes them. Downstream consumers (072 dunning, 082/084/086/087/088/
// 089-W/090) re-point to these signatures in a LATER chat — the apps/web stub is
// intentionally left untouched here.
//
// SCHEMA SOURCE — RAW SQL, not the Drizzle model. packages/db/src/schema/
// subscriptions.ts is STALE vs applied migration 20260601000008 (omits provider,
// status, stripe_price_id, apple_product_id, canceled_at, cancellation_reason,
// cancellation_reason_text). db:pull is broken; do NOT resync it here. Every read
// and write below runs as raw parameterized SQL against the migration-008 columns.
//
// TRANSACTIONS — each transition opens a Postgres transaction and takes a
// `SELECT ... FOR UPDATE` row lock on the user's subscription row, so two
// Stripe/Apple webhooks firing for the same user within milliseconds serialize
// instead of racing. subscriptions.status and the denormalized
// users.subscription_status cache are written atomically inside that transaction;
// any mid-transition throw rolls the whole thing back.
import { randomInt } from 'node:crypto';
import { sql, type Database } from '@vesper/db';

// --- state model -------------------------------------------------------------

// The persisted enum has SIX values (subscription_status_enum, migration 1).
// `deleted` is NOT one of them — it is a LOGICAL terminal only, modelling
// row-ABSENCE after the hard-delete worker removes the row. NO transition may
// ever write status='deleted'; assertPersistable() enforces this at runtime.
export const PERSISTED_SUBSCRIPTION_STATUS = [
  'trial',
  'active',
  'past_due',
  'read_only',
  'archived',
  'deletion_scheduled',
] as const;

export type PersistedSubscriptionStatus =
  (typeof PERSISTED_SUBSCRIPTION_STATUS)[number];

/** Logical state set: the six persisted values plus the absence-only `deleted`. */
export type SubscriptionState = PersistedSubscriptionStatus | 'deleted';

/** cancellation_reason_enum (migration 1). Persisted to subscriptions.cancellation_reason. */
export const CANCELLATION_REASONS = [
  'price_too_high',
  'not_using_enough',
  'found_alternative',
  'life_change',
  'technical_issues',
  'other',
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

// --- referral mint config ----------------------------------------------------

/** users.referral_code is a 6-char base62 slug (TECHNICAL_SPEC §3, live column type `text`). */
export const REFERRAL_CODE_LENGTH = 6;
/** Max UNIQUE-collision retries before giving up (TECHNICAL_SPEC §3 users.referral_code). */
export const REFERRAL_MINT_MAX_ATTEMPTS = 5;

const BASE62 =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function generateReferralCode(): string {
  let out = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i += 1) {
    out += BASE62[randomInt(BASE62.length)];
  }
  return out;
}

// --- errors ------------------------------------------------------------------

/** Thrown when a transition is requested from an illegal source state (§8). */
export class IllegalSubscriptionTransitionError extends Error {
  readonly from: PersistedSubscriptionStatus | null;
  readonly to: SubscriptionState;

  constructor(
    from: PersistedSubscriptionStatus | null,
    to: SubscriptionState,
    detail?: string,
  ) {
    super(
      `Illegal subscription transition: ${from ?? '(none)'} -> ${to}` +
        (detail ? ` (${detail})` : ''),
    );
    this.name = 'IllegalSubscriptionTransitionError';
    this.from = from;
    this.to = to;
  }
}

// --- external-call contract --------------------------------------------------

// Structural type for the one Stripe call this module makes. We deliberately do
// NOT import the `stripe` package here — @vesper/shared must not pull Stripe's
// types into every consumer. The real Stripe client is structurally assignable
// (stripe.subscriptions.cancel(id, params?, options?)).
export interface StripeCanceler {
  subscriptions: {
    cancel(id: string, ...args: unknown[]): Promise<unknown>;
  };
}

export interface DeletionSideEffectOptions {
  /** Injected Stripe client (mocked in tests). Required to cancel a Stripe sub. */
  stripe?: StripeCanceler;
}

// --- legal edge map (TECHNICAL_SPEC §8, lines 1533-1539) ---------------------
// Keyed by TARGET state -> the set of source states that may legally reach it.
// `deletion_scheduled` has a NATURAL source set (archived only, the cron path)
// and a broader EXPLICIT set used by requestDeletion (account-delete request).
// Note: deletion_scheduled -> read_only (account/restore) is NOT a machine edge;
// the restore route performs its own direct users UPDATE outside this machine.

const SOURCES_ACTIVE: readonly PersistedSubscriptionStatus[] = [
  'trial',
  'past_due',
  'read_only',
  'archived',
];
const SOURCES_PAST_DUE: readonly PersistedSubscriptionStatus[] = ['active'];
const SOURCES_READ_ONLY: readonly PersistedSubscriptionStatus[] = [
  'trial',
  'active',
  'past_due',
];
const SOURCES_ARCHIVED: readonly PersistedSubscriptionStatus[] = ['read_only'];
const SOURCES_DELETION_SCHEDULED_NATURAL: readonly PersistedSubscriptionStatus[] =
  ['archived'];
const SOURCES_DELETION_SCHEDULED_EXPLICIT: readonly PersistedSubscriptionStatus[] =
  ['trial', 'active', 'past_due', 'read_only', 'archived'];

// --- internals ---------------------------------------------------------------

/** Transaction handle inferred from the canonical Drizzle client. */
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

interface SubscriptionRowState {
  status: PersistedSubscriptionStatus;
  provider: 'stripe' | 'apple';
  stripe_subscription_id: string | null;
}

/** Belt-and-suspenders guard: refuse to persist any non-enum status (esp. 'deleted'). */
function assertPersistable(
  status: string,
): asserts status is PersistedSubscriptionStatus {
  if (
    !(PERSISTED_SUBSCRIPTION_STATUS as readonly string[]).includes(status)
  ) {
    throw new Error(
      `Refusing to persist non-enum subscription status: ${status}`,
    );
  }
}

/** Row-lock the user's subscription and confirm the source state is legal for `target`. */
async function lockAndValidate(
  tx: Tx,
  userId: string,
  target: PersistedSubscriptionStatus,
  allowedSources: readonly PersistedSubscriptionStatus[],
): Promise<SubscriptionRowState> {
  const rows = (await tx.execute(sql`
    SELECT status, provider, stripe_subscription_id
    FROM subscriptions
    WHERE user_id = ${userId}::uuid
    FOR UPDATE
  `)) as unknown as SubscriptionRowState[];

  const row = rows[0];
  if (!row) {
    throw new IllegalSubscriptionTransitionError(
      null,
      target,
      'no subscription row for user',
    );
  }
  if (!allowedSources.includes(row.status)) {
    throw new IllegalSubscriptionTransitionError(row.status, target);
  }
  return row;
}

/** Atomically write subscriptions.status AND the users cache; optionally persist a cancellation reason. */
async function writeStatus(
  tx: Tx,
  userId: string,
  status: PersistedSubscriptionStatus,
  reason?: CancellationReason,
): Promise<void> {
  assertPersistable(status);

  if (reason) {
    await tx.execute(sql`
      UPDATE subscriptions
      SET status = ${status}::subscription_status_enum,
          cancellation_reason = ${reason}::cancellation_reason_enum,
          updated_at = now()
      WHERE user_id = ${userId}::uuid
    `);
  } else {
    await tx.execute(sql`
      UPDATE subscriptions
      SET status = ${status}::subscription_status_enum,
          updated_at = now()
      WHERE user_id = ${userId}::uuid
    `);
  }

  await tx.execute(sql`
    UPDATE users
    SET subscription_status = ${status}::subscription_status_enum,
        updated_at = now()
    WHERE id = ${userId}::uuid
  `);
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: string }).code === '23505'
  );
}

/**
 * Mint users.referral_code if the user has none. Idempotent: a user who already
 * has a code is left untouched. On a UNIQUE collision, regenerate and retry up to
 * REFERRAL_MINT_MAX_ATTEMPTS.
 *
 * Each attempt runs inside its OWN nested transaction (SAVEPOINT) — NOT a bare
 * try/catch. A UNIQUE violation aborts the surrounding transaction in Postgres;
 * without a savepoint the following status UPDATE would fail with "current
 * transaction is aborted". The savepoint lets a colliding attempt roll back only
 * itself, leaving the outer transition transaction intact.
 */
async function mintReferralCodeIfAbsent(tx: Tx, userId: string): Promise<void> {
  const rows = (await tx.execute(sql`
    SELECT referral_code
    FROM users
    WHERE id = ${userId}::uuid
    FOR UPDATE
  `)) as unknown as Array<{ referral_code: string | null }>;

  if (rows[0]?.referral_code) {
    return; // already minted — idempotent, never overwrite an existing code.
  }

  for (let attempt = 0; attempt < REFERRAL_MINT_MAX_ATTEMPTS; attempt += 1) {
    const code = generateReferralCode();
    try {
      await tx.transaction(async (sp) => {
        await sp.execute(sql`
          UPDATE users
          SET referral_code = ${code}
          WHERE id = ${userId}::uuid AND referral_code IS NULL
        `);
      });
      return; // minted.
    } catch (e) {
      if (isUniqueViolation(e)) {
        continue; // collision — regenerate and retry within the savepoint bound.
      }
      throw e;
    }
  }

  throw new Error(
    `Failed to mint a unique referral_code after ${REFERRAL_MINT_MAX_ATTEMPTS} attempts.`,
  );
}

/**
 * Shared deletion-scheduling core. The DB state change (status + apple's
 * deletion_requested_at) is committed atomically; the Stripe cancellation is an
 * external, non-transactional call made AFTER commit (see scheduleDeletion doc).
 */
async function scheduleDeletion(
  db: Database,
  userId: string,
  allowedSources: readonly PersistedSubscriptionStatus[],
  reason?: CancellationReason,
  opts?: DeletionSideEffectOptions,
): Promise<void> {
  const row = await db.transaction(async (tx) => {
    const r = await lockAndValidate(
      tx,
      userId,
      'deletion_scheduled',
      allowedSources,
    );
    await writeStatus(tx, userId, 'deletion_scheduled', reason);

    // Apple cannot be cancelled server-side (Apple policy): set the deletion
    // clock and rely on the UI instruction surface. Pure DB — stays in the txn.
    if (r.provider === 'apple') {
      await tx.execute(sql`
        UPDATE users
        SET deletion_requested_at = now()
        WHERE id = ${userId}::uuid
      `);
    }
    return r;
  });

  // Stripe cancellation runs AFTER commit: it is a non-transactional network
  // call, and holding the FOR UPDATE row lock across it would serialize/deadlock
  // concurrent webhooks — the exact race the lock exists to prevent. The trade-off
  // is a possible Stripe-failed-after-DB-committed drift (row=deletion_scheduled,
  // Stripe sub still active). RECONCILIATION: the (later) hard-delete / dunning
  // sweep re-checks deletion_scheduled Stripe rows and re-issues the cancel; the
  // call is safe to repeat (cancelling an already-cancelled sub is a no-op/error
  // the sweep tolerates).
  if (row.provider === 'stripe' && opts?.stripe && row.stripe_subscription_id) {
    await opts.stripe.subscriptions.cancel(row.stripe_subscription_id);
  }
}

// --- public transitions (frozen signature: fn(db, userId, ...)) --------------

/**
 * trial | past_due | read_only | archived -> active.
 * Side effect: mint users.referral_code if absent (idempotent, collision-retried).
 */
export function transitionToActive(
  db: Database,
  userId: string,
): Promise<void> {
  return db.transaction(async (tx) => {
    await lockAndValidate(tx, userId, 'active', SOURCES_ACTIVE);
    await writeStatus(tx, userId, 'active');
    await mintReferralCodeIfAbsent(tx, userId);
  });
}

/** active -> past_due (payment fails). No external call. */
export function transitionToPastDue(
  db: Database,
  userId: string,
): Promise<void> {
  return db.transaction(async (tx) => {
    await lockAndValidate(tx, userId, 'past_due', SOURCES_PAST_DUE);
    await writeStatus(tx, userId, 'past_due');
  });
}

/**
 * trial | active | past_due -> read_only (trial non-conversion, cancel, dunning fail).
 * `reason` is optional and, when supplied, persisted to subscriptions.cancellation_reason.
 */
export function transitionToReadOnly(
  db: Database,
  userId: string,
  reason?: CancellationReason,
): Promise<void> {
  return db.transaction(async (tx) => {
    await lockAndValidate(tx, userId, 'read_only', SOURCES_READ_ONLY);
    await writeStatus(tx, userId, 'read_only', reason);
  });
}

/** read_only -> archived (7 days elapse). No external call. */
export function transitionToArchived(
  db: Database,
  userId: string,
): Promise<void> {
  return db.transaction(async (tx) => {
    await lockAndValidate(tx, userId, 'archived', SOURCES_ARCHIVED);
    await writeStatus(tx, userId, 'archived');
  });
}

/**
 * archived -> deletion_scheduled (30 days elapse — the natural cron path).
 * `reason`, when supplied, is persisted to subscriptions.cancellation_reason.
 * Provider side effect: Stripe -> cancel after commit; Apple -> set
 * users.deletion_requested_at (no server cancel — Apple policy).
 */
export function transitionToDeletionScheduled(
  db: Database,
  userId: string,
  reason?: CancellationReason,
  opts?: DeletionSideEffectOptions,
): Promise<void> {
  return scheduleDeletion(
    db,
    userId,
    SOURCES_DELETION_SCHEDULED_NATURAL,
    reason,
    opts,
  );
}

/**
 * trial | active | past_due | read_only | archived -> deletion_scheduled, via an
 * EXPLICIT account-delete request (the `* -> deletion_scheduled` edge in §8).
 * Same provider side effects as transitionToDeletionScheduled.
 */
export function requestDeletion(
  db: Database,
  userId: string,
  reason?: CancellationReason,
  opts?: DeletionSideEffectOptions,
): Promise<void> {
  return scheduleDeletion(
    db,
    userId,
    SOURCES_DELETION_SCHEDULED_EXPLICIT,
    reason,
    opts,
  );
}
