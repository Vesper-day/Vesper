// Prior-week completion read core logic (Chat 057 — DECISION A), extracted from
// route.ts. Next.js App Router route files may export ONLY HTTP-method handlers +
// segment config, so the pure functions live here; route.ts imports them and the
// integration test drives getPriorWeekCompletion directly against the chat-002
// local-Supabase test DB.
//
// SOURCE (DECISION A): the step-1 completion percentage derives from completion_log
// BLOCK events, NOT weekly_priorities.completedAt (which no landed route ever sets —
// it is structurally always null). No existing completion/stats read returns a
// prior-week block-completion rate (generatePlan/regenerationLimits only WRITE or
// count plan_* events), so this is the single thin authenticated read that computes it.
//
// completion_log COLUMN SKEW: the applied migration 20260601000010 has real columns
// (user_id, block_id, event_type, value, logged_at). The ORM model
// packages/db/src/schema/analytics.ts is STALE (event_name/occurred_at) and is NOT
// used or edited here — we read the REAL columns via raw parameterized SQL (the read
// analog of the write in generatePlan.ts / the count in regenerationLimits.ts).
//
// WINDOW: the target planning week's Monday is resolved the same way the 029 GET
// resolves ?weekStart (mondayOf / UTC Monday) — surfaces pass the COMING Monday as
// weekStart so the reviewed window is the just-ended week. The reviewed window is
// [targetMonday − 7 days, targetMonday) — i.e. the Mon–Sun immediately before the
// target Monday (logged_at >= priorMonday::date AND logged_at < targetMonday::date).
//
// DENOMINATOR: of blocks ACTIONED in the window, the share completed —
//   completed = count(block_completed)
//   total     = count(block_completed + block_skipped + block_rescheduled)
//   rate      = completed / total, or null when total = 0 (no data → "nothing to
//               review yet", handled by the surface as a plain state, not 0% graded).
// A never-actioned scheduled block logs nothing, so a true "all scheduled blocks"
// denominator is not cleanly available without new wiring — the actioned-share
// denominator is used deliberately.
import { sql, type Database } from '@vesper/db';

export interface WeeklyReviewResponse {
  weeklyReview: {
    /** The target planning week's Monday (YYYY-MM-DD) — the week being planned. */
    weekStartDate: string;
    /** The reviewed prior week's Monday (targetMonday − 7 days). */
    priorWeekStart: string;
    /** completion_log block_completed count in the prior-week window. */
    completed: number;
    /** block_completed + block_skipped + block_rescheduled count in the window. */
    total: number;
    /** completed / total in [0,1], or null when no blocks were actioned. */
    rate: number | null;
  };
}

/**
 * The Monday (UTC) of the week containing `d`, as YYYY-MM-DD. Mirrors the 029
 * weekly-priorities mondayOf exactly (getUTCDay 0=Sun..6=Sat; offset back = (day+6)%7).
 */
export function mondayOf(d: Date): string {
  const day = d.getUTCDay();
  const offset = (day + 6) % 7;
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset),
  );
  return monday.toISOString().slice(0, 10);
}

/** Shift a YYYY-MM-DD date string by `n` days (UTC), returning YYYY-MM-DD. */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Prior-week block-completion review for the target planning week. `weekStart`
 * (YYYY-MM-DD) is the target Monday; when omitted the current UTC Monday is used
 * (029-GET-parity default). The reviewed window is the Mon–Sun immediately before
 * the target Monday. Returns completed/total counts + a rate (null when total = 0).
 */
export async function getPriorWeekCompletion(
  db: Database,
  userId: string,
  weekStart?: string,
  now: Date = new Date(),
): Promise<WeeklyReviewResponse> {
  const weekStartDate = weekStart ?? mondayOf(now);
  const priorWeekStart = addDays(weekStartDate, -7);

  const rows = (await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE event_type = 'block_completed')::int AS completed,
      count(*) FILTER (
        WHERE event_type IN ('block_completed', 'block_skipped', 'block_rescheduled')
      )::int AS total
    FROM completion_log
    WHERE user_id = ${userId}::uuid
      AND event_type IN ('block_completed', 'block_skipped', 'block_rescheduled')
      AND logged_at >= ${priorWeekStart}::date
      AND logged_at <  ${weekStartDate}::date
  `)) as unknown as Array<{ completed: number; total: number }>;

  const completed = rows[0]?.completed ?? 0;
  const total = rows[0]?.total ?? 0;
  const rate = total === 0 ? null : completed / total;

  return {
    weeklyReview: { weekStartDate, priorWeekStart, completed, total, rate },
  };
}
