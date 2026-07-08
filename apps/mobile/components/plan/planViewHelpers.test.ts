// Pure-helper unit tests for the mobile plan day view (build chat 040).
//
// These cover the three EXTRACTED pure helpers — block-sort comparator, empty-state
// selector, rollover math — with NO react-native import (there is no @testing-library
// in mobile deps; this is the 054-W / 039 pure-helper test pattern). The module under
// test imports only ./types (pure), so nothing here pulls RN's Flow source through
// vitest's SSR transform.
import { describe, it, expect } from 'vitest';
import {
  blockSortComparator,
  selectEmptyStateVariant,
  hasRolledOver,
  nextLocalMidnight,
} from './planViewHelpers';
import type { PlanBlock } from './types';

const block = (startTime: string, displayOrder: number): Pick<PlanBlock, 'startTime' | 'displayOrder'> => ({
  startTime,
  displayOrder,
});

describe('blockSortComparator', () => {
  it('orders by startTime ascending', () => {
    const sorted = [
      block('2026-07-07T15:00:00.000Z', 0),
      block('2026-07-07T08:00:00.000Z', 0),
      block('2026-07-07T12:00:00.000Z', 0),
    ].sort(blockSortComparator);
    expect(sorted.map((b) => b.startTime)).toEqual([
      '2026-07-07T08:00:00.000Z',
      '2026-07-07T12:00:00.000Z',
      '2026-07-07T15:00:00.000Z',
    ]);
  });

  it('uses displayOrder as the tiebreaker for equal startTime', () => {
    const sorted = [
      block('2026-07-07T08:00:00.000Z', 2),
      block('2026-07-07T08:00:00.000Z', 0),
      block('2026-07-07T08:00:00.000Z', 1),
    ].sort(blockSortComparator);
    expect(sorted.map((b) => b.displayOrder)).toEqual([0, 1, 2]);
  });

  it('returns 0 on full equality (stable)', () => {
    expect(blockSortComparator(block('2026-07-07T08:00:00.000Z', 3), block('2026-07-07T08:00:00.000Z', 3))).toBe(0);
  });
});

describe('selectEmptyStateVariant', () => {
  it('maps a PLAN_NOT_FOUND code to the no-plan-yet CTA', () => {
    expect(selectEmptyStateVariant({ errorCode: 'PLAN_NOT_FOUND' })).toBe('no-plan-yet');
  });

  it('maps a bare 404 status to the no-plan-yet CTA', () => {
    expect(selectEmptyStateVariant({ httpStatus: 404 })).toBe('no-plan-yet');
  });

  it('prefers the fallback apology over a 404 when a fallback notice is present', () => {
    expect(
      selectEmptyStateVariant({
        httpStatus: 404,
        fallbackSource: 'fallback',
        fallbackNotice: 'My apologies — I could not craft a plan just now.',
      }),
    ).toBe('fallback-apology');
  });

  it('falls back to the generic error surface for any other failure', () => {
    expect(selectEmptyStateVariant({ httpStatus: 500 })).toBe('error');
    expect(selectEmptyStateVariant({})).toBe('error');
  });
});

describe('rollover math', () => {
  const TZ = 'America/Los_Angeles';

  it('does NOT roll over on a same-day poll', () => {
    // 2026-07-07 18:00 UTC → 11:00 local (UTC-7 in July) → still 2026-07-07.
    const now = new Date('2026-07-07T18:00:00.000Z');
    expect(hasRolledOver('2026-07-07', now, TZ)).toBe(false);
  });

  it('rolls over once the local clock crosses midnight', () => {
    // 2026-07-08 08:00 UTC → 01:00 local on 2026-07-08 → advanced past 2026-07-07.
    const now = new Date('2026-07-08T08:00:00.000Z');
    expect(hasRolledOver('2026-07-07', now, TZ)).toBe(true);
  });

  it('does not advance early in the last minute before local midnight', () => {
    // 2026-07-08 06:59 UTC → 23:59 local on 2026-07-07 (UTC-7) → still the same day.
    const now = new Date('2026-07-08T06:59:00.000Z');
    expect(hasRolledOver('2026-07-07', now, TZ)).toBe(false);
  });

  it('nextLocalMidnight returns the following calendar day', () => {
    const now = new Date('2026-07-07T18:00:00.000Z'); // local 2026-07-07
    expect(nextLocalMidnight(now, TZ)).toBe('2026-07-08');
  });
});
