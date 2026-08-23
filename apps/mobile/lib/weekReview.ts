// Pure helpers for the Step-5 seven-day review grid (Chat 058, mobile twin of
// apps/web/lib/weekly-planning/weekReview.ts). Zero react-native / @vesper imports — a
// plain data transform, offline-safe under vitest with no RN mock. The date math is
// inlined (rather than importing lib/weeklyPlanning, which pulls the API client) so
// this stays a leaf module.
//
// The generated-week shape mirrors @vesper/ai's WeeklyTemplate; server-side
// WeeklyTemplateSchema is the source of truth for what the accept route persists.

/** Shift a YYYY-MM-DD by n days (UTC), returning YYYY-MM-DD. Inlined leaf helper. */
function addDaysUtc(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

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

export interface GridDay {
  dayIndex: number;
  date: string;
  plan: { blocks: GridBlock[]; note?: string };
}

export type BlockPatch = Partial<Pick<GridBlock, 'title' | 'startTime' | 'endTime'>>;

/** Build the seven-day review grid: sort by dayIndex, stamp each day's calendar date. */
export function buildWeekGrid(week: GeneratedWeek, targetMonday: string): GridDay[] {
  return week.days
    .slice()
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .map((day) => ({
      dayIndex: day.dayIndex,
      date: addDaysUtc(targetMonday, day.dayIndex),
      plan: day.plan,
    }));
}

/** Patch one block's title/times immutably. Out-of-range indices are no-ops. */
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

/** Remove one block from a day, immutably, re-sequencing displayOrder. */
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

export interface AcceptWeekPayload {
  targetMonday: string;
  days: GeneratedDay[];
}

/** Build the accept batch-write payload, dropping the grid-only date field. */
export function buildAcceptPayload(grid: GridDay[], targetMonday: string): AcceptWeekPayload {
  return {
    targetMonday,
    days: grid
      .slice()
      .sort((a, b) => a.dayIndex - b.dayIndex)
      .map((day) => ({ dayIndex: day.dayIndex, plan: day.plan })),
  };
}
