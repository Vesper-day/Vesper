// Pure, framework-free helpers for the mobile plan day view (build chat 040).
//
// The unit-tested (planViewHelpers.test.ts) parts of the day view: block ordering,
// empty-state selection, and local-midnight rollover math. Import NO react-native and
// NO I/O so the test graph never touches RN's Flow source (vitest SSR transform would
// choke) and the helpers run in a plain node test.
//
// ROLLOVER SHARE-VS-DUPLICATE (chat-040 determination): the web day view (039) put the
// identical math in web-local modules — apps/web/lib/dates/localDate.ts
// (localDateInTimeZone) + apps/web/components/plan/planViewHelpers.ts (nextLocalMidnight
// / hasRolledOver). Mobile cannot import apps/web. Rather than extract a new
// @vesper/shared export (which would mean editing src/index.ts + a subpath entry +
// `pnpm --filter @vesper/shared build` before the mobile type-check), the tz-math is
// DUPLICATED here: it is a ~10-line pure Intl computation with no other consumer, so a
// local copy is cheaper and better isolated than a shared surface. Kept byte-for-byte
// equivalent to the web helper so the two day boundaries stay in agreement.
import type { PlanBlock } from './types';

// --- block ordering ---------------------------------------------------------

/**
 * Order the §9 PlanResponse blocks for the vertical timeline: startTime ascending,
 * with displayOrder as the tiebreaker for blocks that share a startTime. ISO-8601 UTC
 * strings ('…Z') sort lexicographically in chronological order, so a string compare is
 * correct here (no Date parse). Returns 0 on full equality so Array.sort stays stable.
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
 * Inputs the day view can present to the empty state. Kept loose (all optional) so both
 * the plan-query error path and the generation-result path feed the same selector:
 *   - errorCode / httpStatus: from a failed GET /plans/date read (PlanQueryError).
 *   - fallbackSource / fallbackNotice: from a POST /plans/generate that settled
 *     source:'fallback' (§9 "no plan can be generated right now").
 */
export interface EmptyStateSelectionInput {
  // `| undefined` is explicit (not just `?:`) so callers can pass a possibly-undefined
  // value directly under exactOptionalPropertyTypes (e.g. query.error?.code).
  errorCode?: string | null | undefined;
  httpStatus?: number | null | undefined;
  fallbackSource?: string | null | undefined;
  fallbackNotice?: string | null | undefined;
}

/**
 * Map a plan-query / generation outcome to the empty-state variant to render. A
 * fallback plan is checked FIRST: it means generation actually ran and produced an
 * apology, a more specific signal than a plain 404. A PLAN_NOT_FOUND 404 (by code or
 * status) → the "no plan yet" CTA. Anything else → the generic error surface.
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

/**
 * The user's current local date ("YYYY-MM-DD") in `ianaTimezone` at instant `now`.
 * DUPLICATE of apps/web/lib/dates/localDate.ts localDateInTimeZone — Intl resolves the
 * zone's UTC offset for the given instant, so it is DST-correct on either side of a
 * transition. Hermes ships full Intl on SDK 54, so this runs on-device unchanged.
 */
export function localDateInTimeZone(ianaTimezone: string, now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const find = (type: 'year' | 'month' | 'day'): string => {
    const part = parts.find((p) => p.type === type);
    if (!part) {
      throw new Error(
        `localDateInTimeZone: missing ${type} part for timezone "${ianaTimezone}"`,
      );
    }
    return part.value;
  };

  return `${find('year')}-${find('month')}-${find('day')}`;
}

/** Add one calendar day to a "YYYY-MM-DD" string (UTC-noon anchored, DST-agnostic). */
function addOneCalendarDay(date: string): string {
  // Anchor at UTC noon so the +24h step never lands on a DST-shifted wall clock — this
  // is pure calendar arithmetic on the date string, not on a local instant.
  const next = new Date(`${date}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/**
 * The local calendar day AFTER the local date at `now` in `timeZone` — the date the
 * view should advance to once the clock crosses local midnight.
 */
export function nextLocalMidnight(now: Date, timeZone: string): string {
  return addOneCalendarDay(localDateInTimeZone(timeZone, now));
}

/**
 * True once the user's local calendar date has advanced past `displayedDate` — the
 * signal to roll the day view over. False while still on the same local day (including
 * the last minute before midnight). String compare is valid for zero-padded YYYY-MM-DD.
 */
export function hasRolledOver(
  displayedDate: string,
  now: Date,
  timeZone: string,
): boolean {
  return localDateInTimeZone(timeZone, now) > displayedDate;
}
