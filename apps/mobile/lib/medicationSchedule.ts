// PURE medication-reminder scheduling helpers (Chat 060). This module has NO
// react-native and NO expo-notifications import so it is unit-testable under the
// node vitest env with zero mocking (medicationSchedule.test.ts). The thin
// expo-notifications wrapper that consumes these specs lives in
// lib/medicationReminders.ts.
//
// F2 CONTRACT (the whole point of this file):
//   shift_out_of_quiet_hours = false  -> fire at the EXACT scheduled time, never
//     silently delayed. This is the DEFAULT and the safe behavior for a dose.
//   shift_out_of_quiet_hours = true   -> the dose MAY be shifted out of the
//     quiet-hours window, but ONLY when a quiet-hours window is actually supplied.
//
// QUIET-HOURS WINDOW SOURCE (chat 060 determination): the live repo has NO
// quiet-hours window utility (046/059a not landed — only BaseProfile.wakeTarget /
// bedtimeTarget exist). So callers pass `quietWindow: undefined`, and the shift=true
// path is a defensive no-op: applyQuietHoursShift returns the time unchanged, i.e.
// the fire-on-time default holds. The window logic is implemented in full so that
// when a window source lands, only the caller changes — not this pure core.

export type MedicationFrequency = 'daily' | 'twice_daily' | 'weekly' | 'custom';

/** A quiet-hours window as two "HH:MM" local times. `start` may be later than `end`
 * to express a window that wraps past midnight (e.g. 22:00 -> 07:00). */
export interface QuietHoursWindow {
  start: string; // HH:MM
  end: string; // HH:MM
}

/** A parsed time-of-day. */
export interface TimeOfDay {
  hour: number; // 0-23
  minute: number; // 0-59
}

/** One computed reminder. `repeat: 'daily'` fires every day at hour:minute;
 * `repeat: 'weekly'` fires weekly on `weekday` (Apple/expo convention: 1=Sunday .. 7=Saturday). */
export interface ReminderSpec {
  hour: number;
  minute: number;
  repeat: 'daily' | 'weekly';
  weekday?: number; // 1-7, present only when repeat === 'weekly'
}

export interface ComputeRemindersInput {
  times: string[];
  frequency: MedicationFrequency;
  startDate: string; // YYYY-MM-DD
  shiftOutOfQuietHours: boolean;
  /** Absent in the current repo (see file header) — pass undefined. */
  quietWindow?: QuietHoursWindow;
}

/** Thrown when a times[] entry is not a valid 24-hour time-of-day. The reminder
 * wrapper catches this and routes it to the failure telemetry event. */
export class InvalidMedicationTimeError extends Error {
  readonly value: string;
  constructor(value: string) {
    super(`Invalid medication time: "${value}". Expected 24-hour HH:MM or HH:MM:SS.`);
    this.name = 'InvalidMedicationTimeError';
    this.value = value;
  }
}

const TIME_OF_DAY = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

/** True when `s` is a valid 24-hour "HH:MM" or "HH:MM:SS" (the Postgres time wire
 * shape). Seconds, when present, are validated but ignored by the scheduler. */
export function isValidTimeOfDay(s: string): boolean {
  return TIME_OF_DAY.test(s);
}

/** Parse "HH:MM[:SS]" into { hour, minute }, or null when malformed. */
export function parseTimeOfDay(s: string): TimeOfDay | null {
  const m = TIME_OF_DAY.exec(s);
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

/** Split the valid entries from the malformed ones. */
export function partitionTimes(times: string[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const t of times) (isValidTimeOfDay(t) ? valid : invalid).push(t);
  return { valid, invalid };
}

/** Day-of-week for a "YYYY-MM-DD" date in the Apple/expo WEEKLY convention
 * (1=Sunday .. 7=Saturday), or null when the date is malformed. Uses UTC so the
 * weekday is stable regardless of the host timezone. */
export function weekdayFromDate(isoDate: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  const [, y, mo, d] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getUTCDay() + 1; // getUTCDay: 0=Sun..6=Sat -> 1..7
}

function minutesSinceMidnight(t: TimeOfDay): number {
  return t.hour * 60 + t.minute;
}

/** Is `t` inside the quiet-hours window [start, end)? Handles a window that wraps
 * past midnight (start > end). */
function isWithinWindow(t: TimeOfDay, window: QuietHoursWindow): boolean {
  const start = parseTimeOfDay(window.start);
  const end = parseTimeOfDay(window.end);
  if (!start || !end) return false;
  const T = minutesSinceMidnight(t);
  const S = minutesSinceMidnight(start);
  const E = minutesSinceMidnight(end);
  if (S === E) return false; // empty / whole-day ambiguous window -> treat as no window
  return S < E ? T >= S && T < E : T >= S || T < E;
}

/**
 * The F2 quiet-hours decision. Returns the (possibly shifted) fire time.
 *   - shift === false          -> ALWAYS returns `t` unchanged (fire-on-time).
 *   - shift === true, no window -> returns `t` unchanged (defensive no-op).
 *   - shift === true, window, t inside the window -> returns the window END time
 *     (the dose is moved to just after quiet hours).
 *   - shift === true, window, t outside the window -> returns `t` unchanged.
 */
export function applyQuietHoursShift(
  t: TimeOfDay,
  shift: boolean,
  window?: QuietHoursWindow,
): TimeOfDay {
  if (!shift || !window) return t;
  if (!isWithinWindow(t, window)) return t;
  const end = parseTimeOfDay(window.end);
  return end ?? t;
}

/**
 * Compute the reminder specs for a medication. Throws
 * {@link InvalidMedicationTimeError} on the FIRST malformed time so the wrapper can
 * surface a schedule failure rather than silently dropping a dose.
 *
 * Frequency mapping:
 *   - daily / twice_daily / custom : each time fires DAILY (every day).
 *   - weekly                       : each time fires WEEKLY on the start_date weekday.
 * The quiet-hours shift is applied per-time via {@link applyQuietHoursShift} (a
 * no-op today — see file header).
 */
export function computeMedicationReminders(input: ComputeRemindersInput): ReminderSpec[] {
  const { times, frequency, startDate, shiftOutOfQuietHours, quietWindow } = input;

  for (const raw of times) {
    if (!isValidTimeOfDay(raw)) throw new InvalidMedicationTimeError(raw);
  }

  const weekday = frequency === 'weekly' ? weekdayFromDate(startDate) : null;
  if (frequency === 'weekly' && weekday === null) {
    throw new InvalidMedicationTimeError(startDate);
  }

  return times.map((raw) => {
    // Non-null: every entry passed isValidTimeOfDay above.
    const base = parseTimeOfDay(raw)!;
    const fire = applyQuietHoursShift(base, shiftOutOfQuietHours, quietWindow);
    return frequency === 'weekly'
      ? { hour: fire.hour, minute: fire.minute, repeat: 'weekly', weekday: weekday! }
      : { hour: fire.hour, minute: fire.minute, repeat: 'daily' };
  });
}
