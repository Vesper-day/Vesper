// @vitest-environment node
//
// Unit tests for localDateInTimeZone — the app-layer mirror of the DB-side
// start_of_local_day(tz). No DB; pure Intl math, so these run in the default
// `pnpm test` (not gated on VESPER_DB_TESTS).
import { describe, it, expect } from 'vitest';
import { localDateInTimeZone } from './localDate';

describe('localDateInTimeZone', () => {
  // The worked §-contract case: at 06:00Z on Jan 2, Los Angeles (UTC-8 in winter)
  // is still on Jan 1 at 22:00 → "today" must be 2026-01-01, NOT the server/UTC
  // 2026-01-02. Guards the (a) wrong-day-at-the-edge failure mode.
  it('uses the user timezone, not UTC, at the day edge', () => {
    const serverNow = new Date('2026-01-02T06:00:00.000Z');
    expect(localDateInTimeZone('America/Los_Angeles', serverNow)).toBe('2026-01-01');
    // Same instant, UTC → the next calendar day. Confirms the difference is real.
    expect(localDateInTimeZone('UTC', serverNow)).toBe('2026-01-02');
  });

  // DST-transition correctness: US spring-forward 2026 is 2026-03-08T10:00Z
  // (02:00 → 03:00 PST→PDT). An instant just AFTER the jump is UTC-7; just before
  // the day starts LA is still UTC-8. Intl resolves the correct offset for each
  // instant, so the calendar date is right on both sides.
  it('is DST-correct across the spring-forward boundary', () => {
    // 09:30Z on the transition day = 01:30 PST (pre-jump) → still Mar 8 in LA.
    const beforeJump = new Date('2026-03-08T09:30:00.000Z');
    expect(localDateInTimeZone('America/Los_Angeles', beforeJump)).toBe('2026-03-08');

    // 06:30Z = 22:30 PST on Mar 7 (UTC-8, before the jump) → still Mar 7 in LA,
    // proving we are not naively subtracting a fixed 7h DST offset.
    const eveningBefore = new Date('2026-03-08T06:30:00.000Z');
    expect(localDateInTimeZone('America/Los_Angeles', eveningBefore)).toBe('2026-03-07');
  });
});
