// @vitest-environment node
//
// Unit tests for the RRULE recurrence expander (recurrence.ts). Pure, offline —
// no DB. Asserts that a stored RRULE + a query window yields the correct
// instances for that window, that per-instance duration is preserved, and that
// the function is pure (mutates none of its inputs / persists nothing).
import { describe, it, expect } from 'vitest';
import { expandRecurrence, isValidRrule } from './recurrence';

describe('expandRecurrence', () => {
  // "Every Mon & Wed 09:00–10:00", series anchored Mon 2026-06-01.
  const base = {
    rrule: 'FREQ=WEEKLY;BYDAY=MO,WE',
    seriesStart: new Date('2026-06-01T09:00:00.000Z'),
    seriesEnd: new Date('2026-06-01T10:00:00.000Z'),
  };

  it('yields exactly the Mon+Wed instances inside a one-week window', () => {
    const out = expandRecurrence({
      ...base,
      windowStart: new Date('2026-06-08T00:00:00.000Z'),
      windowEnd: new Date('2026-06-15T00:00:00.000Z'),
    });
    expect(out.map((i) => i.start.toISOString())).toEqual([
      '2026-06-08T09:00:00.000Z', // Mon
      '2026-06-10T09:00:00.000Z', // Wed
    ]);
  });

  it('preserves the per-instance duration (1h)', () => {
    const out = expandRecurrence({
      ...base,
      windowStart: new Date('2026-06-08T00:00:00.000Z'),
      windowEnd: new Date('2026-06-09T00:00:00.000Z'),
    });
    expect(out).toHaveLength(1);
    const inst = out[0]!;
    expect(inst.end.getTime() - inst.start.getTime()).toBe(60 * 60 * 1000);
    expect(inst.end.toISOString()).toBe('2026-06-08T10:00:00.000Z');
  });

  it('returns nothing for a window before the series starts', () => {
    const out = expandRecurrence({
      ...base,
      windowStart: new Date('2026-05-01T00:00:00.000Z'),
      windowEnd: new Date('2026-05-31T00:00:00.000Z'),
    });
    expect(out).toHaveLength(0);
  });

  it('honors COUNT (stops after N occurrences)', () => {
    const out = expandRecurrence({
      ...base,
      rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=2',
      windowStart: new Date('2026-06-01T00:00:00.000Z'),
      windowEnd: new Date('2026-12-31T00:00:00.000Z'),
    });
    // First two Mondays only: 2026-06-01 and 2026-06-08.
    expect(out.map((i) => i.start.toISOString())).toEqual([
      '2026-06-01T09:00:00.000Z',
      '2026-06-08T09:00:00.000Z',
    ]);
  });

  it('does not mutate its input Dates (purity)', () => {
    const seriesStart = new Date('2026-06-01T09:00:00.000Z');
    const seriesEnd = new Date('2026-06-01T10:00:00.000Z');
    const windowStart = new Date('2026-06-08T00:00:00.000Z');
    const windowEnd = new Date('2026-06-15T00:00:00.000Z');
    const snapshot = [seriesStart, seriesEnd, windowStart, windowEnd].map((d) => d.getTime());
    expandRecurrence({ rrule: base.rrule, seriesStart, seriesEnd, windowStart, windowEnd });
    expect([seriesStart, seriesEnd, windowStart, windowEnd].map((d) => d.getTime())).toEqual(
      snapshot,
    );
  });
});

describe('isValidRrule', () => {
  it('accepts well-formed RRULEs', () => {
    expect(isValidRrule('FREQ=WEEKLY;BYDAY=MO,WE')).toBe(true);
    expect(isValidRrule('FREQ=DAILY;INTERVAL=2')).toBe(true);
  });
  it('rejects garbage', () => {
    expect(isValidRrule('not-an-rrule')).toBe(false);
    expect(isValidRrule('')).toBe(false);
  });
});
