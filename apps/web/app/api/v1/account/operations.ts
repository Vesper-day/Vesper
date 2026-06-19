// Account deletion / restore core logic (§9 "Account", §4 Account Deletion Flow),
// shared by the delete + restore route handlers. A route.ts may export ONLY HTTP
// handlers + segment config, so the pure functions live here (mirrors
// tasks/operations.ts).
//
// SCHEMA SOURCE — RAW SQL for the subscriptions read (same staleness as
// subscription/operations.ts: the ORM model omits `provider`/`status`). The
// `users` UPDATE uses the Drizzle model (users.ts matches §3 for the two columns
// touched: subscription_status, deletion_requested_at).
//
// IMPORTANT — security_audit_log is NOT written here. That table is trigger-only,
// scoped to medications+integrations, has no event_type column, and the
// application never writes it (§3 table 19). The kickoff's "delete/restore
// co-writes security_audit_log" rule was DROPPED as unsupported by §3/§4/§9; see
// docs/CHAT_030_RESOLUTION_RECORD.md.
import type Stripe from 'stripe';
import { users, eq, sql, type Database } from '@vesper/db';
import { ApiError, ErrorCode } from '@vesper/shared';

const GRACE_PERIOD_DAYS = 30; // §4 Phase 2 — 30-day grace before hard delete.

export interface DeleteAccountResponse {
  deletionScheduledAt: string; // ISO 8601
  hardDeleteAt: string; // deletionScheduledAt + 30 days (§4 grace)
}

/**
 * POST /api/v1/account/delete (§4 Phase 1) — initiate the deletion flow.
 *
 * Service-role UPDATE: deletion_requested_at = now(), subscription_status =
 * 'deletion_scheduled'. Then, per provider:
 *   - Stripe + active  → cancel the Stripe subscription SYNCHRONOUSLY so no
 *     charge can land before the 30-day hard delete (§4 Phase 1). A null `stripe`
 *     client with an active Stripe sub is a misconfiguration → 500.
 *   - Apple            → NO server-side cancel (Apple policy); the client (which
 *     knows the provider from GET /subscription) surfaces the iOS Settings cancel
 *     instruction. The §9 response body stays the exact two fields — we do not add
 *     an Apple flag to it (defer-to-spec; see resolution record).
 *
 * Session invalidation + push-token cleanup are the ROUTE's responsibility
 * (best-effort), not this pure DB function, so the integration test can drive it
 * without Supabase Auth.
 */
export async function deleteAccount(
  db: Database,
  stripe: Stripe | null,
  userId: string,
): Promise<DeleteAccountResponse> {
  const updated = await db
    .update(users)
    .set({
      deletionRequestedAt: sql`now()`,
      subscriptionStatus: 'deletion_scheduled',
    })
    .where(eq(users.id, userId))
    .returning({ deletionRequestedAt: users.deletionRequestedAt });

  const row = updated[0];
  if (!row || !row.deletionRequestedAt) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'User record not found.');
  }
  const deletionScheduledAt = row.deletionRequestedAt;

  // subscriptions ORM model is stale (no provider/status) — raw SQL read.
  const subs = (await db.execute(sql`
    SELECT provider, status, stripe_subscription_id
    FROM subscriptions
    WHERE user_id = ${userId}::uuid
    LIMIT 1
  `)) as unknown as Array<{
    provider: string;
    status: string;
    stripe_subscription_id: string | null;
  }>;

  const sub = subs[0];
  if (sub && sub.provider === 'stripe' && sub.status === 'active') {
    if (!sub.stripe_subscription_id) {
      throw new ApiError(
        ErrorCode.INTEGRATION_ERROR,
        'Active Stripe subscription is missing its subscription id.',
      );
    }
    if (!stripe) {
      throw new ApiError(
        ErrorCode.INTERNAL_ERROR,
        'STRIPE_SECRET_KEY is not configured; cannot cancel the active subscription.',
      );
    }
    // Synchronous cancel — must complete before we return so no charge can post.
    await stripe.subscriptions.cancel(sub.stripe_subscription_id);
  }
  // Apple-managed subscriptions: no server-side cancel (handled via iOS Settings).

  const hardDeleteAt = new Date(
    deletionScheduledAt.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  );

  return {
    deletionScheduledAt: deletionScheduledAt.toISOString(),
    hardDeleteAt: hardDeleteAt.toISOString(),
  };
}

/**
 * POST /api/v1/account/restore (§4 Phase 2) — cancel a pending deletion.
 *
 * Service-role UPDATE: clears deletion_requested_at and transitions
 * subscription_status back to 'read_only', from which the user can resubscribe.
 * Returns nothing (the route emits an empty 200).
 */
export async function restoreAccount(db: Database, userId: string): Promise<void> {
  const updated = await db
    .update(users)
    .set({
      deletionRequestedAt: null,
      subscriptionStatus: 'read_only',
    })
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  if (!updated[0]) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'User record not found.');
  }
}
