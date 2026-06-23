// RRULE recurrence expander for built-in calendar_events (TECHNICAL_SPEC §3 #25).
//
// The table stores ONLY the iCalendar RRULE string plus the series' first
// start_time / end_time. Recurrence instances are EXPANDED ON READ for the
// requested window and NEVER written back to the table — persisting expanded
// instances is a bug (§3 #25). This module is the single place that turns a
// stored (rrule, seriesStart, seriesEnd) tuple into concrete instances for a
// query window. It is a PURE function: it reads nothing, writes nothing, and
// touches no database.
//
// Built on the `rrule` npm package (RFC 5545). The stored RRULE has no DTSTART
// line (we store the series start separately), so DTSTART is supplied as the
// `dtstart` option at parse time. Each occurrence keeps the series' per-instance
// duration: instanceEnd = occurrenceStart + (seriesEnd - seriesStart).
import { RRule, rrulestr } from 'rrule';

export interface RecurrenceInstance {
  /** Instance start (UTC instant). */
  start: Date;
  /** Instance end = start + series duration (UTC instant). */
  end: Date;
}

export interface ExpandArgs {
  /** Stored iCalendar RRULE string, e.g. "FREQ=WEEKLY;BYDAY=MO,WE". */
  rrule: string;
  /** Series first-instance start (the row's start_time). */
  seriesStart: Date;
  /** Series first-instance end (the row's end_time); fixes per-instance duration. */
  seriesEnd: Date;
  /** Inclusive lower bound of the read window. */
  windowStart: Date;
  /** Inclusive upper bound of the read window. */
  windowEnd: Date;
}

/**
 * `rrule` evaluates everything in UTC but compares against the local-time fields
 * of the Date objects it is handed. To get correct results for absolute instants
 * we shift a Date by its timezone offset so its UTC clock-face equals the
 * original local clock-face, then shift back on the way out. This keeps the
 * expander correct regardless of the server's local timezone.
 */
function toRruleUtc(date: Date): Date {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
}

function fromRruleUtc(date: Date): Date {
  return new Date(date.getTime() + date.getTimezoneOffset() * 60_000);
}

/**
 * Expand a stored RRULE into the concrete instances that fall inside
 * [windowStart, windowEnd] (inclusive). Pure — persists nothing.
 *
 * Returns instances sorted ascending by start. An instance is included when its
 * START lies within the window. The per-instance duration is fixed by the series
 * (seriesEnd - seriesStart), so an instance starting just inside the window keeps
 * its full length even if its end spills past windowEnd.
 *
 * @throws if the RRULE string cannot be parsed.
 */
export function expandRecurrence(args: ExpandArgs): RecurrenceInstance[] {
  const { rrule, seriesStart, seriesEnd, windowStart, windowEnd } = args;

  const durationMs = seriesEnd.getTime() - seriesStart.getTime();

  // Parse with the series start as DTSTART (the stored string omits it).
  const rule = rrulestr(rrule, { dtstart: toRruleUtc(seriesStart) });

  // RRule#between is computed in the rrule-UTC frame, so shift the window in and
  // the occurrences back out.
  const occurrences = rule.between(
    toRruleUtc(windowStart),
    toRruleUtc(windowEnd),
    true, // inclusive
  );

  return occurrences.map((occ) => {
    const start = fromRruleUtc(occ);
    return { start, end: new Date(start.getTime() + durationMs) };
  });
}

/**
 * Validate that a string is a parseable RRULE (used by request validation so a
 * malformed rrule is rejected as a 400 before insert rather than surfacing later
 * at read time). Returns true iff `rrulestr` accepts it as a single RRULE.
 */
export function isValidRrule(rrule: string): boolean {
  try {
    const parsed = rrulestr(rrule, { dtstart: new Date(Date.UTC(2000, 0, 1)) });
    // rrulestr can return an RRuleSet; for our single-line stored strings we
    // require a plain RRule with a frequency.
    return parsed instanceof RRule && typeof parsed.options.freq === 'number';
  } catch {
    return false;
  }
}
