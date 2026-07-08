// @vitest-environment node
//
// Unit tests for the PURE medication schedule helpers (medicationSchedule.ts). This
// module imports NO react-native / expo-notifications, so it needs NO mock — it runs
// directly under the node vitest env.
//
// Focus: the F2 fire-on-time default (shift=false NEVER delays a dose), shift-out
// only when the flag is true AND a window is supplied, frequency-adjusted scheduling
// (daily / twice_daily / weekly / custom), and times[] validation.
import { describe, it, expect } from 'vitest';
import {
  isValidTimeOfDay,
  parseTimeOfDay,
  partitionTimes,
  weekdayFromDate,
  applyQuietHoursShift,
  computeMedicationReminders,
  InvalidMedicationTimeError,
  type QuietHoursWindow,
} from './medicationSchedule';

describe('isValidTimeOfDay / parseTimeOfDay', () => {
  it('accepts HH:MM and HH:MM:SS, rejects malformed entries', () => {
    expect(isValidTimeOfDay('08:00')).toBe(true);
    expect(isValidTimeOfDay('23:59')).toBe(true);
    expect(isValidTimeOfDay('08:00:00')).toBe(true);
    expect(isValidTimeOfDay('8:00')).toBe(false);
    expect(isValidTimeOfDay('24:00')).toBe(false);
    expect(isValidTimeOfDay('08:60')).toBe(false);
    expect(isValidTimeOfDay('noon')).toBe(false);
    expect(isValidTimeOfDay('')).toBe(false);
  });

  it('parses HH:MM[:SS] into hour/minute, ignoring seconds', () => {
    expect(parseTimeOfDay('08:30')).toEqual({ hour: 8, minute: 30 });
    expect(parseTimeOfDay('20:05:45')).toEqual({ hour: 20, minute: 5 });
    expect(parseTimeOfDay('bad')).toBeNull();
  });

  it('partitions valid from invalid times', () => {
    expect(partitionTimes(['08:00', 'bad', '20:00:00', '25:00'])).toEqual({
      valid: ['08:00', '20:00:00'],
      invalid: ['bad', '25:00'],
    });
  });
});

describe('weekdayFromDate (expo 1=Sun..7=Sat)', () => {
  it('maps known dates', () => {
    expect(weekdayFromDate('2026-07-05')).toBe(1); // Sunday
    expect(weekdayFromDate('2026-07-06')).toBe(2); // Monday
    expect(weekdayFromDate('2026-07-11')).toBe(7); // Saturday
    expect(weekdayFromDate('not-a-date')).toBeNull();
  });
});

describe('applyQuietHoursShift — F2 default is fire-on-time', () => {
  const window: QuietHoursWindow = { start: '22:00', end: '07:00' }; // wraps midnight

  it('shift=false NEVER changes the time, even inside a window', () => {
    expect(applyQuietHoursShift({ hour: 23, minute: 0 }, false, window)).toEqual({
      hour: 23,
      minute: 0,
    });
    expect(applyQuietHoursShift({ hour: 3, minute: 30 }, false, window)).toEqual({
      hour: 3,
      minute: 30,
    });
  });

  it('shift=true but NO window is a no-op (defensive — matches the absent-source case)', () => {
    expect(applyQuietHoursShift({ hour: 3, minute: 0 }, true, undefined)).toEqual({
      hour: 3,
      minute: 0,
    });
  });

  it('shift=true WITH a window moves an in-window dose to the window end', () => {
    // 03:00 is inside 22:00->07:00, so it shifts to 07:00.
    expect(applyQuietHoursShift({ hour: 3, minute: 0 }, true, window)).toEqual({
      hour: 7,
      minute: 0,
    });
    // 23:30 is inside the wrapping window -> shifts to 07:00.
    expect(applyQuietHoursShift({ hour: 23, minute: 30 }, true, window)).toEqual({
      hour: 7,
      minute: 0,
    });
  });

  it('shift=true WITH a window leaves an out-of-window dose untouched', () => {
    // 12:00 is outside 22:00->07:00.
    expect(applyQuietHoursShift({ hour: 12, minute: 0 }, true, window)).toEqual({
      hour: 12,
      minute: 0,
    });
  });
});

describe('computeMedicationReminders — frequency-adjusted', () => {
  const base = { startDate: '2026-07-06', shiftOutOfQuietHours: false } as const; // Monday

  it('daily: one daily reminder per time, no weekday', () => {
    const specs = computeMedicationReminders({
      ...base,
      frequency: 'daily',
      times: ['08:00'],
    });
    expect(specs).toEqual([{ hour: 8, minute: 0, repeat: 'daily' }]);
  });

  it('twice_daily: one daily reminder per time', () => {
    const specs = computeMedicationReminders({
      ...base,
      frequency: 'twice_daily',
      times: ['08:00', '20:00:00'],
    });
    expect(specs).toEqual([
      { hour: 8, minute: 0, repeat: 'daily' },
      { hour: 20, minute: 0, repeat: 'daily' },
    ]);
  });

  it('custom: each time fires daily (best-effort fallback)', () => {
    const specs = computeMedicationReminders({
      ...base,
      frequency: 'custom',
      times: ['06:15', '14:45'],
    });
    expect(specs.every((s) => s.repeat === 'daily')).toBe(true);
    expect(specs).toHaveLength(2);
  });

  it('weekly: each time fires weekly on the start_date weekday', () => {
    const specs = computeMedicationReminders({
      ...base, // 2026-07-06 is a Monday -> weekday 2
      frequency: 'weekly',
      times: ['09:00'],
    });
    expect(specs).toEqual([{ hour: 9, minute: 0, repeat: 'weekly', weekday: 2 }]);
  });

  it('fire-on-time: shift=false leaves every dose at its exact time', () => {
    const specs = computeMedicationReminders({
      startDate: '2026-07-06',
      shiftOutOfQuietHours: false,
      frequency: 'daily',
      times: ['03:00'], // would be "quiet hours" but no delay applies
      quietWindow: { start: '22:00', end: '07:00' },
    });
    expect(specs).toEqual([{ hour: 3, minute: 0, repeat: 'daily' }]);
  });

  it('shift-out only when the flag is true and a window is present', () => {
    const specs = computeMedicationReminders({
      startDate: '2026-07-06',
      shiftOutOfQuietHours: true,
      frequency: 'daily',
      times: ['03:00'],
      quietWindow: { start: '22:00', end: '07:00' },
    });
    expect(specs).toEqual([{ hour: 7, minute: 0, repeat: 'daily' }]);
  });

  it('throws InvalidMedicationTimeError on a malformed time', () => {
    expect(() =>
      computeMedicationReminders({ ...base, frequency: 'daily', times: ['08:00', '25:00'] }),
    ).toThrow(InvalidMedicationTimeError);
  });
});
