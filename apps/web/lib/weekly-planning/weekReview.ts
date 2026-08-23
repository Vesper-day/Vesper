// Pure helpers for the Step-5 seven-day review grid (Chat 058, web). Client-safe: no
// @vesper/shared barrel, no @vesper/ai, no DB, no network — importable from a
// 'use client' file. Maps the generated week into a date-stamped grid, applies
// block-level adjustments immutably, and builds the accept request body.
//
// The generated-week shape mirrors @vesper/ai's WeeklyTemplate, declared locally here
// (the twin precedent). Server-side validation (WeeklyTemplateSchema) is the source
// of truth for what the accept route will actually persist.
import { addDays } from './week';

export interface GridBlock {
  startTime: string;
  endTime: string;
  blockType: string;
  title: string;
  details: unknown;
  source: 'ai_generated';
  displayOrder: number;
}
export interface GeneratedDay {
  dayIndex: number;
  plan: { blocks: GridBlock[]; note?: string };
}
export interface GeneratedWeek {
  days: GeneratedDay[];
}

/** One day in the review grid: its calendar date + the day's plan. */
export interface GridDay {
  dayIndex: number;
  /** ISO YYYY-MM-DD, derived from the target Monday + dayIndex. */
  date: string;
  plan: { blocks: GridBlock[]; note?: string };
}

/** A block-level adjustment: the reviewer edits a block's title and/or its times. */
export type BlockPatch = Partial<Pick<GridBlock, 'title' | 'startTime' | 'endTime'>>;

/**
 * Build the seven-day review grid: stamp each generated day with its calendar date
 * (target Monday + dayIndex) and sort by dayIndex so the grid always reads Monday
 * first. Purely functional.
 */
export function buildWeekGrid(week: GeneratedWeek, targetMonday: string): GridDay[] {
  return week.days
    .slice()
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .map((day) => ({
      dayIndex: day.dayIndex,
      date: addDays(targetMonday, day.dayIndex),
      plan: day.plan,
    }));
}

/**
 * Apply a block-level adjustment to one block, immutably. dayIndex + blockIndex locate
 * the block; the patch overrides its title/times. Out-of-range indices return the grid
 * unchanged.
 */
export function editGridBlock(
  grid: GridDay[],
  dayIndex: number,
  blockIndex: number,
  patch: BlockPatch,
): GridDay[] {
  return grid.map((day) => {
    if (day.dayIndex !== dayIndex) return day;
    if (blockIndex < 0 || blockIndex >= day.plan.blocks.length) return day;
    const blocks = day.plan.blocks.map((b, i) => (i === blockIndex ? { ...b, ...patch } : b));
    return { ...day, plan: { ...day.plan, blocks } };
  });
}

/**
 * Remove one block from a day, immutably, and re-sequence displayOrder contiguously.
 */
export function removeGridBlock(
  grid: GridDay[],
  dayIndex: number,
  blockIndex: number,
): GridDay[] {
  return grid.map((day) => {
    if (day.dayIndex !== dayIndex) return day;
    if (blockIndex < 0 || blockIndex >= day.plan.blocks.length) return day;
    const blocks = day.plan.blocks
      .filter((_, i) => i !== blockIndex)
      .map((b, i) => ({ ...b, displayOrder: i }));
    return { ...day, plan: { ...day.plan, blocks } };
  });
}

/** The accept request body: the target week + the reviewed days (grid dates dropped). */
export interface AcceptWeekPayload {
  targetMonday: string;
  days: GeneratedDay[];
}

/**
 * Build the accept batch-write payload from the reviewed grid. Strips the grid-only
 * `date` field (the server re-derives each plan_date from targetMonday + dayIndex via
 * start_of_local_day), returning the { dayIndex, plan } days the accept route persists.
 */
export function buildAcceptPayload(grid: GridDay[], targetMonday: string): AcceptWeekPayload {
  return {
    targetMonday,
    days: grid
      .slice()
      .sort((a, b) => a.dayIndex - b.dayIndex)
      .map((day) => ({ dayIndex: day.dayIndex, plan: day.plan })),
  };
}
