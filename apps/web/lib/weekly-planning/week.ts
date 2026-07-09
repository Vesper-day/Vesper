// Pure week-math for the web weekly-planning surface (Chat 057). Client-safe: no
// @vesper/shared barrel, no DB, no network — importable from a 'use client' file.
// Shared by SundayPrompt (dismissal key + Sunday gate) and the session page (target
// week + calendar window). Mirrors the 029 mondayOf UTC anchoring.

/** The Monday (UTC) of the week containing `d`, as YYYY-MM-DD. */
export function mondayOf(d: Date): string {
  const day = d.getUTCDay();
  const offset = (day + 6) % 7;
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset),
  );
  return monday.toISOString().slice(0, 10);
}

/** Shift a YYYY-MM-DD string by `n` days (UTC), returning YYYY-MM-DD. */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The TARGET planning week's Monday: the coming week's Monday (the week AHEAD). A
 * Sunday session plans the week starting the next day, so the target is the Monday
 * after the week containing `now`. The reviewed prior week is then exactly the week
 * just ending (target − 7 .. target − 1).
 */
export function comingMonday(now: Date = new Date()): string {
  return addDays(mondayOf(now), 7);
}

/** True when the LOCAL day is Sunday (the Sunday-prompt visibility gate). */
export function isLocalSunday(now: Date = new Date()): boolean {
  return now.getDay() === 0;
}

/**
 * Inclusive Mon–Sun ISO window for a target-week Monday (YYYY-MM-DD): Monday
 * 00:00:00.000Z → Sunday 23:59:59.999Z. Used for the step-3 calendar read.
 */
export function weekWindow(monday: string): { start: string; end: string } {
  const start = new Date(`${monday}T00:00:00.000Z`);
  const sunday = new Date(start);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const end = new Date(
    Date.UTC(
      sunday.getUTCFullYear(),
      sunday.getUTCMonth(),
      sunday.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
  return { start: start.toISOString(), end: end.toISOString() };
}

/** localStorage key for the Sunday-prompt dismissal — per user + target week. */
export function dismissalKey(userId: string, weekStartDate: string): string {
  return `vesper.weekly-planning.dismissed.${userId}.${weekStartDate}`;
}
