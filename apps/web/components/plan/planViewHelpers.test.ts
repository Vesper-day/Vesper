// @vitest-environment node
//
// Unit tests for the pure day-view helpers (build chat 039). No DOM: web has no
// @testing-library/react, so the timeline/card/skeleton render is covered by
// exercising the extracted pure logic (ordering, empty-state selection, rollover
// math), not a component render. Rollover math delegates to localDateInTimeZone,
// so these run in the default `pnpm test` (not VESPER_DB_TESTS-gated).
import { describe, it, expect } from 'vitest';
import {
  blockSortComparator,
  selectEmptyStateVariant,
  nextLocalMidnight,
  hasRolledOver,
} from './planViewHelpers';

describe('blockSortComparator', () => {
  it('orders earlier startTime first', () => {
    const a = { startTime: '2026-07-07T08:00:00.000Z', displayOrder: 5 };
    const b = { startTime: '2026-07-07T09:00:00.000Z', displayOrder: 0 };
    expect(blockSortComparator(a, b)).toBeLessThan(0);
    expect(blockSortComparator(b, a)).toBeGreaterThan(0);
  });

  it('breaks an equal startTime by lower displayOrder first', () => {
    const a = { startTime: '2026-07-07T08:00:00.000Z', displayOrder: 1 };
    const b = { startTime: '2026-07-07T08:00:00.000Z', displayOrder: 4 };
    expect(blockSortComparator(a, b)).toBeLessThan(0);
    expect(blockSortComparator(b, a)).toBeGreaterThan(0);
  });

  it('is stable (0) on full equality', () => {
    const a = { startTime: '2026-07-07T08:00:00.000Z', displayOrder: 2 };
    const b = { startTime: '2026-07-07T08:00:00.000Z', displayOrder: 2 };
    expect(blockSortComparator(a, b)).toBe(0);
  });

  it('sorts a full list startTime asc, displayOrder tiebreak', () => {
    const blocks = [
      { startTime: '2026-07-07T10:00:00.000Z', displayOrder: 0 },
      { startTime: '2026-07-07T08:00:00.000Z', displayOrder: 2 },
      { startTime: '2026-07-07T08:00:00.000Z', displayOrder: 1 },
    ];
    const sorted = [...blocks].sort(blockSortComparator).map((b) => b.displayOrder);
    // Two 08:00 blocks first (1 then 2), then the 10:00 block.
    expect(sorted).toEqual([1, 2, 0]);
  });
});

describe('selectEmptyStateVariant', () => {
  it('maps a PLAN_NOT_FOUND 404 to no-plan-yet (by code)', () => {
    expect(selectEmptyStateVariant({ errorCode: 'PLAN_NOT_FOUND' })).toBe('no-plan-yet');
  });

  it('maps a 404 status to no-plan-yet (by status)', () => {
    expect(selectEmptyStateVariant({ httpStatus: 404 })).toBe('no-plan-yet');
  });

  it('maps a source:fallback plan to fallback-apology', () => {
    expect(
      selectEmptyStateVariant({
        fallbackSource: 'fallback',
        fallbackNotice: 'I could not build a full plan just now.',
      }),
    ).toBe('fallback-apology');
  });

  it('prefers fallback-apology over a co-present 404', () => {
    expect(
      selectEmptyStateVariant({
        httpStatus: 404,
        fallbackSource: 'fallback',
        fallbackNotice: 'apology',
      }),
    ).toBe('fallback-apology');
  });

  it('maps a generic error to error', () => {
    expect(selectEmptyStateVariant({ errorCode: 'INTERNAL_ERROR', httpStatus: 500 })).toBe(
      'error',
    );
    expect(selectEmptyStateVariant({})).toBe('error');
  });
});

describe('rollover date math', () => {
  // LA is UTC-8 in July? No — LA is UTC-7 (PDT) in July. Pick an instant that is
  // 23:59 local in LA: 2026-07-08T06:59Z = 23:59 PDT on Jul 7.
  const justBeforeMidnight = new Date('2026-07-08T06:59:00.000Z'); // 23:59 Jul 7 LA
  const justAfterMidnight = new Date('2026-07-08T07:01:00.000Z'); // 00:01 Jul 8 LA
  const tz = 'America/Los_Angeles';

  it('nextLocalMidnight returns the following local calendar day', () => {
    // Local date at `justBeforeMidnight` is 2026-07-07; next is 2026-07-08.
    expect(nextLocalMidnight(justBeforeMidnight, tz)).toBe('2026-07-08');
  });

  it('nextLocalMidnight is DST-agnostic across a spring-forward day', () => {
    // 2026-03-08 is US spring-forward. Late on Mar 8 local, next day is Mar 9.
    const lateMar8 = new Date('2026-03-09T05:00:00.000Z'); // 22:00 Mar 8 LA (PDT, UTC-7)
    expect(nextLocalMidnight(lateMar8, tz)).toBe('2026-03-09');
  });

  it('hasRolledOver is false before local midnight, true after', () => {
    expect(hasRolledOver('2026-07-07', justBeforeMidnight, tz)).toBe(false);
    expect(hasRolledOver('2026-07-07', justAfterMidnight, tz)).toBe(true);
  });
});
