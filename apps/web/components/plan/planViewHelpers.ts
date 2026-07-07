// Pure, framework-free helpers for the web plan day view (build chat 039).
//
// These are the extracted, unit-tested (planViewHelpers.test.ts) parts of the day
// view: block ordering, empty-state selection, and rollover date math. They import
// NO React and NO DOM — the timezone math delegates to the live app-layer util
// (lib/dates/localDate.ts, the mirror of the DB start_of_local_day(tz)) so the
// client and server agree on the day boundary and stay DST-safe.
import { localDateInTimeZone } from '@/lib/dates/localDate';
import type { PlanBlock } from '@/app/api/v1/plans/operations';

// --- block ordering ---------------------------------------------------------

/**
 * Order the §9 PlanResponse blocks for the vertical timeline: startTime ascending,
 * with displayOrder as the tiebreaker for blocks that share a startTime. ISO-8601
 * UTC strings ('…Z') sort lexicographically in chronological order, so a string
 * compare is correct here (no Date parse needed). Returns 0 on full equality so
 * Array.prototype.sort stays stable.
 */
export function blockSortComparator(
  a: Pick<PlanBlock, 'startTime' | 'displayOrder'>,
  b: Pick<PlanBlock, 'startTime' | 'displayOrder'>,
): number {
  if (a.startTime < b.startTime) return -1;
  if (a.startTime > b.startTime) return 1;
  return a.displayOrder - b.displayOrder;
}

// --- empty-state selection --------------------------------------------------

export type EmptyStateVariant = 'no-plan-yet' | 'fallback-apology' | 'error';

/**
 * Inputs the day view can present to the empty state. Kept loose (all optional) so
 * both the plan-query error path and the generation-result path feed the same
 * selector:
 *   - errorCode / httpStatus: from a failed GET /plans/date read (PlanQueryError).
 *   - fallbackSource / fallbackNotice: from a POST /plans/generate `done` event
 *     that came back source:'fallback' (§9 "no plan can be generated right now").
 */
export interface EmptyStateSelectionInput {
  // `| undefined` is explicit (not just `?:`) so callers can pass a possibly-
  // undefined value directly under exactOptionalPropertyTypes (e.g. query.error?.code).
  errorCode?: string | null | undefined;
  httpStatus?: number | null | undefined;
  fallbackSource?: string | null | undefined;
  fallbackNotice?: string | null | undefined;
}

/**
 * Map a plan-query / generation outcome to the empty-state variant to render.
 * A fallback plan is checked FIRST: it means generation actually ran and produced
 * an apology, which is a more specific signal than a plain 404. A PLAN_NOT_FOUND
 * 404 (by code or status) → the "no plan generated yet" CTA. Anything else → the
 * generic error surface.
 */
export function selectEmptyStateVariant(
  input: EmptyStateSelectionInput,
): EmptyStateVariant {
  if (input.fallbackSource === 'fallback' && input.fallbackNotice) {
    return 'fallback-apology';
  }
  if (input.errorCode === 'PLAN_NOT_FOUND' || input.httpStatus === 404) {
    return 'no-plan-yet';
  }
  return 'error';
}

// --- rollover date math -----------------------------------------------------

/** Add one calendar day to a "YYYY-MM-DD" string (UTC-noon anchored, DST-agnostic). */
function addOneCalendarDay(date: string): string {
  // Anchor at UTC noon so the +24h step never lands on a DST-shifted wall clock —
  // this is pure calendar arithmetic on the date string, not on a local instant.
  const next = new Date(`${date}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/**
 * The local calendar day AFTER the local date at `now` in `timeZone` — i.e. the
 * date the view should advance to once the clock crosses local midnight. Delegates
 * the current-local-date read to localDateInTimeZone (same Intl approach as the
 * live util), so it is DST-correct on either side of a transition.
 */
export function nextLocalMidnight(now: Date, timeZone: string): string {
  return addOneCalendarDay(localDateInTimeZone(timeZone, now));
}

/**
 * True once the user's local calendar date has advanced past `displayedDate` — the
 * signal to roll the day view over to the new date. False while still on the same
 * local day (including the last minute before midnight). String compare is valid
 * for zero-padded YYYY-MM-DD.
 */
export function hasRolledOver(
  displayedDate: string,
  now: Date,
  timeZone: string,
): boolean {
  return localDateInTimeZone(timeZone, now) > displayedDate;
}
