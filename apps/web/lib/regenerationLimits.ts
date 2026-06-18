// Plan-generation regeneration caps (chat 025).
//
// Two MUTUALLY EXCLUSIVE caps. The route reads subscription_status ONCE and
// routes to EXACTLY ONE of these — they never compose:
//
//   trial  -> checkTrialCap:  2 generations per LOCAL day  (block the 3rd)
//   else   -> checkActiveCap: 5 generations per ROLLING hour (block the 6th)
//
// Each throws a 429 ApiError when the cap is exceeded; the route surfaces that
// before acquiring the idempotency lock (no lock is taken for a capped request).
//
// completion_log column skew (chat-024 decision, carried here): the applied
// migration 20260601000010 defines (user_id, block_id, event_type, value,
// logged_at). The ORM model packages/db/src/schema/analytics.ts is STALE
// (event_name/occurred_at) and is NOT used or edited here — chat-006 drizzle-kit
// pull is the durable fix. The trial count therefore reads the REAL columns via
// raw SQL: event_type and logged_at (NOT a non-existent created_at — the chat-025
// brief said "created_at", but the real column is logged_at).
import { ApiError, ErrorCode, withRateLimit } from '@vesper/shared';
import { sql, type Database } from '@vesper/db';

/** The user fields each cap needs. Subset of AuthenticatedUser. */
export interface RegenUser {
  id: string;
  timezone: string;
}

/** Trial users: 2 generations per LOCAL calendar day. */
export const TRIAL_DAILY_CAP = 2;

/**
 * Trial cap. Counts completion_log rows for this user with event_type in
 * ('plan_generated','plan_regenerated') whose logged_at is at or after the start
 * of the user's current LOCAL day. The day boundary is computed in Postgres via
 * start_of_local_day(timezone) so DST is correct (the function is STABLE and
 * timezone-aware; chat 004). Throws 429 when the count has already reached
 * TRIAL_DAILY_CAP (i.e. blocks the 3rd generation in a local day).
 */
export async function checkTrialCap(db: Database, user: RegenUser): Promise<void> {
  const rows = (await db.execute(sql`
    SELECT count(*)::int AS n
    FROM completion_log
    WHERE user_id = ${user.id}::uuid
      AND event_type IN ('plan_generated', 'plan_regenerated')
      AND logged_at >= start_of_local_day(${user.timezone})
  `)) as unknown as Array<{ n: number }>;

  const count = rows[0]?.n ?? 0;
  if (count >= TRIAL_DAILY_CAP) {
    throw new ApiError(
      ErrorCode.RATE_LIMITED,
      `Trial plans are limited to ${TRIAL_DAILY_CAP} per day. Your next plan will be available tomorrow.`,
      429,
    );
  }
}

/**
 * Active (paid) cap. Delegates to the chat-009 Upstash sliding-window token
 * bucket 'plan-generate' (5 tokens / 1 hour, RATE_LIMITING.md). withRateLimit
 * throws RateLimitError (429, carrying retryAfterSeconds) when the 6th request in
 * the rolling hour is attempted; otherwise returns void.
 */
export async function checkActiveCap(user: RegenUser): Promise<void> {
  await withRateLimit('plan-generate', user.id);
}
