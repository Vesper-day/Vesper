// User-local calendar date utility (chat 026).
//
// Returns the user's CURRENT local date as a "YYYY-MM-DD" string, computed in
// their IANA timezone — NOT the server's local date. This is the app-layer
// mirror of the DB-side start_of_local_day(tz) function (migration 0004a):
//
//   start_of_local_day(tz) = date_trunc('day', now() AT TIME ZONE tz) AT TIME ZONE tz
//
// date_trunc('day', now() AT TIME ZONE tz) is exactly "the local calendar date
// at this instant in tz", which is what we format below. Computing both the
// /plans/today lookup (app layer) and the trial-regen / hydration counters (DB
// layer) from the same definition keeps the day boundary consistent.
//
// DST correctness: Intl.DateTimeFormat resolves the timezone's UTC offset for
// the *given instant*, so it picks the correct offset on either side of a DST
// transition. Worked contract: ianaTimezone = 'America/Los_Angeles',
// serverNow = 2026-01-02T06:00:00Z → local wall-clock is 22:00 on Jan 1
// (UTC-8) → "2026-01-01".

/**
 * The user's current local date ("YYYY-MM-DD") in `ianaTimezone` at the instant
 * `serverNow`. Mirrors start_of_local_day(tz) so the app-layer and DB-layer day
 * boundaries agree.
 */
export function localDateInTimeZone(
  ianaTimezone: string,
  serverNow: Date,
): string {
  // 'en-CA' formats as YYYY-MM-DD, but we read the parts explicitly to avoid any
  // locale-specific separator/ordering surprises and to fail loud on a bad tz.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(serverNow);

  const find = (type: 'year' | 'month' | 'day'): string => {
    const part = parts.find((p) => p.type === type);
    if (!part) {
      throw new Error(`localDateInTimeZone: missing ${type} part for timezone "${ianaTimezone}"`);
    }
    return part.value;
  };

  return `${find('year')}-${find('month')}-${find('day')}`;
}
