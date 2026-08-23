// Pure unit test for the Step-5 review-grid helpers (web). No DOM render, no network.
import { describe, it, expect } from 'vitest';
import {
  buildWeekGrid,
  editGridBlock,
  removeGridBlock,
  buildAcceptPayload,
  type GeneratedWeek,
} from './weekReview';

const TARGET_MONDAY = '2026-08-24';

function block(order: number, title: string, type = 'work') {
  return {
    startTime: '09:00',
    endTime: '10:00',
    blockType: type,
    title,
    details: { blockType: type, tasks: [] },
    source: 'ai_generated' as const,
    displayOrder: order,
  };
}

function makeWeek(): GeneratedWeek {
  // Deliberately out of order to prove buildWeekGrid sorts by dayIndex.
  const days = [6, 0, 1, 2, 3, 4, 5].map((dayIndex) => ({
    dayIndex,
    plan: { blocks: [block(0, `Work ${dayIndex}`), block(1, `Focus ${dayIndex}`, 'focus')] },
  }));
  return { days };
}

describe('buildWeekGrid', () => {
  it('sorts by dayIndex and stamps each day with its calendar date', () => {
    const grid = buildWeekGrid(makeWeek(), TARGET_MONDAY);
    expect(grid.map((d) => d.dayIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(grid[0]!.date).toBe('2026-08-24'); // Monday
    expect(grid[3]!.date).toBe('2026-08-27'); // Thursday
    expect(grid[6]!.date).toBe('2026-08-30'); // Sunday
  });
});

describe('editGridBlock', () => {
  it('patches a block title/times immutably, leaving others untouched', () => {
    const grid = buildWeekGrid(makeWeek(), TARGET_MONDAY);
    const edited = editGridBlock(grid, 2, 1, { title: 'Renamed', startTime: '14:00' });
    const day = edited.find((d) => d.dayIndex === 2)!;
    expect(day.plan.blocks[1]!.title).toBe('Renamed');
    expect(day.plan.blocks[1]!.startTime).toBe('14:00');
    // Original grid unchanged (immutability).
    const orig = grid.find((d) => d.dayIndex === 2)!;
    expect(orig.plan.blocks[1]!.title).toBe('Focus 2');
  });

  it('is a no-op for an out-of-range block index', () => {
    const grid = buildWeekGrid(makeWeek(), TARGET_MONDAY);
    expect(editGridBlock(grid, 2, 99, { title: 'x' })).toEqual(grid);
  });
});

describe('removeGridBlock', () => {
  it('removes a block and re-sequences displayOrder', () => {
    const grid = buildWeekGrid(makeWeek(), TARGET_MONDAY);
    const out = removeGridBlock(grid, 1, 0);
    const day = out.find((d) => d.dayIndex === 1)!;
    expect(day.plan.blocks).toHaveLength(1);
    expect(day.plan.blocks[0]!.title).toBe('Focus 1');
    expect(day.plan.blocks[0]!.displayOrder).toBe(0);
  });
});

describe('buildAcceptPayload', () => {
  it('maps the grid to the accept body, dropping the grid-only date field', () => {
    const grid = buildWeekGrid(makeWeek(), TARGET_MONDAY);
    const payload = buildAcceptPayload(grid, TARGET_MONDAY);
    expect(payload.targetMonday).toBe(TARGET_MONDAY);
    expect(payload.days).toHaveLength(7);
    expect(payload.days.map((d) => d.dayIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    // No grid-only `date` leaks into the persisted payload.
    expect(Object.keys(payload.days[0]!).sort()).toEqual(['dayIndex', 'plan']);
  });

  it('carries block-level adjustments through to the accept payload', () => {
    let grid = buildWeekGrid(makeWeek(), TARGET_MONDAY);
    grid = editGridBlock(grid, 0, 0, { title: 'Kickoff' });
    const payload = buildAcceptPayload(grid, TARGET_MONDAY);
    expect(payload.days[0]!.plan.blocks[0]!.title).toBe('Kickoff');
  });
});
