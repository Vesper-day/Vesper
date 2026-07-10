// Deterministic greedy task -> work-block placement (Chat 055).
//
// PURE + OFFLINE. No I/O, no DB, no model call, no clock. Given the day's pending
// tasks and the open time windows the plan leaves for work, it decides WHICH task
// (by title) lands in WHICH window and how a long task splits across windows. The
// model (chat 022 synthesizePlan / Sonnet) still decides WHEN the work windows sit
// in the day (respecting energy, modules, and fixed calendar events); this module
// only does the arithmetic of filling them, so placement stays reproducible and
// unit-testable without asking the model to schedule tasks.
//
// CARRIER (live-schema truth, block-details.ts): the assigned-task list lives on the
// WORK block variant as `tasks: string[]` (short task DESCRIPTIONS / titles), NOT on
// a `focus` variant. `focus` in the live BlockDetailsSchema is a notes-only generic
// variant with no task array. The build-plan prose ("task -> focus block") predates
// the chat-006 schema; the committed schema carries the list on `work`, so that is
// what we populate. Element type is the task TITLE string (matches the model's own
// output and the DailyPlan tests), NOT the task id.
//
// ALGORITHM
//   sort   tasks by priority DESC (high>medium>low), then deadline ASC (nulls last),
//          stable on input order — identical to readPendingTasks' fetch order.
//   fit    for each task, first-fit the EARLIEST open window whose remaining capacity
//          holds the WHOLE task; place it there.
//   split  if no single window is large enough, split the task across the LARGEST
//          available windows (largest remaining capacity first), filling each until
//          the task is placed. A split task's title therefore appears in more than
//          one block (semantics: same task, continued across windows).
//   carry  the split loop IS the single-day carry-forward: leftover minutes flow to
//          the next available window within the day. Once same-day windows are
//          exhausted the remainder is DROPPED (V1 single-day horizon; cross-day /
//          cross-week rebalancing is V2, PRD deferral).
//
// No minimum-chunk floor in V1: a task fills whatever positive capacity remains (down
// to 1 minute). A MIN_CHUNK_MINUTES floor is a deliberate V2 refinement.
//
// Calendar boundaries are respected UPSTREAM of placeTasks: carveOpenWindows()
// subtracts busy intervals (calendar events) out of the candidate windows, so a
// placed chunk can never overlap a fixed event — placeTasks only ever sees
// event-free windows.

import type { DailyPlan } from '@vesper/shared';

import type { CalendarEvent, PendingTask } from '../context/planContext';

/** Priority rank for the sort: high beats medium beats low; unknown sinks to the bottom. */
const PRIORITY_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

/** An open, plannable interval in minutes-from-midnight. `end` is exclusive, `end > start`. */
export interface OpenWindow {
  /** Links the window back to its source block. Sub-windows carved out of one block
   * share a `<blockId>::<k>` prefix so capacity is tracked per-piece but grouped per-block. */
  id: string;
  start: number;
  end: number;
}

/** A busy interval (fixed calendar event) placement must not overlap. Minutes-from-midnight. */
export interface BusyInterval {
  start: number;
  end: number;
}

/** One task-chunk landed in one window. A split task emits multiple chunks (same id/title). */
export interface PlacedChunk {
  windowId: string;
  taskId: string;
  title: string;
  minutes: number;
}

/**
 * Sort pending tasks for placement: priority DESC, then deadline ASC (nulls last),
 * stable on input order. Mirrors synthesizePlan.readPendingTasks' DB ordering so the
 * algorithm's own order never disagrees with the fetched order.
 */
export function sortTasksForPlacement(tasks: PendingTask[]): PendingTask[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => {
      const rankA = PRIORITY_RANK[a.task.priority] ?? 0;
      const rankB = PRIORITY_RANK[b.task.priority] ?? 0;
      if (rankA !== rankB) return rankB - rankA; // priority DESC

      const dlA = a.task.deadline;
      const dlB = b.task.deadline;
      if (dlA !== dlB) {
        if (dlA === null) return 1; // nulls last
        if (dlB === null) return -1;
        return dlA < dlB ? -1 : 1; // ISO strings sort chronologically; earlier first
      }
      return a.index - b.index; // stable
    })
    .map((entry) => entry.task);
}

/** "HH:MM" (or "00:00" as end-of-day) -> minutes from midnight; null if unparseable. */
function hhmmToMinutes(value: string, asEnd = false): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  const mins = h * 60 + m;
  // "00:00" as an END time means end-of-day (the schema's convention), not midnight-start.
  if (asEnd && mins === 0) return 24 * 60;
  return mins;
}

/**
 * Map calendar events to busy intervals in minutes-from-midnight. Timed events
 * (ISO "…T HH:MM…") contribute their wall-clock HH:MM span. All-day events (date-only,
 * no 'T') carry no specific hours and are skipped — they would otherwise blank the day.
 */
export function calendarEventsToBusy(events: CalendarEvent[]): BusyInterval[] {
  const busy: BusyInterval[] = [];
  for (const event of events) {
    const start = isoTimeToMinutes(event.startTime);
    const end = isoTimeToMinutes(event.endTime);
    if (start === null || end === null || end <= start) continue;
    busy.push({ start, end });
  }
  return busy;
}

/** Extract minutes-from-midnight from an ISO instant's wall-clock time; null for all-day/date-only. */
function isoTimeToMinutes(value: string): number | null {
  // Bare "HH:MM" (already a clock time).
  if (/^\d{2}:\d{2}$/.test(value)) return hhmmToMinutes(value);
  const tIndex = value.indexOf('T');
  if (tIndex === -1) return null; // date-only / all-day event: no specific hours
  return hhmmToMinutes(value.slice(tIndex + 1, tIndex + 6));
}

/**
 * Carve busy intervals out of candidate windows, yielding the event-free open windows.
 * Each surviving piece of a candidate keeps a `<parentId>::<k>` id so downstream
 * write-back can group pieces back onto their originating block while placeTasks still
 * tracks capacity per distinct piece. Output is chronological.
 */
export function carveOpenWindows(
  candidates: OpenWindow[],
  busy: BusyInterval[],
): OpenWindow[] {
  const sortedBusy = [...busy].sort((a, b) => a.start - b.start);
  const out: OpenWindow[] = [];

  for (const candidate of candidates) {
    // Start with the full candidate span; subtract each overlapping busy interval.
    let pieces: Array<{ start: number; end: number }> = [
      { start: candidate.start, end: candidate.end },
    ];
    for (const b of sortedBusy) {
      const next: Array<{ start: number; end: number }> = [];
      for (const piece of pieces) {
        if (b.end <= piece.start || b.start >= piece.end) {
          next.push(piece); // no overlap
          continue;
        }
        if (b.start > piece.start) next.push({ start: piece.start, end: b.start });
        if (b.end < piece.end) next.push({ start: b.end, end: piece.end });
        // fully covered piece contributes nothing
      }
      pieces = next;
    }
    pieces.forEach((piece, k) => {
      if (piece.end > piece.start) {
        out.push({ id: `${candidate.id}::${k}`, start: piece.start, end: piece.end });
      }
    });
  }

  return out.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

/**
 * The greedy core: place sorted tasks into open windows. Returns one chunk per
 * (task, window) landing. Never places more minutes into a window than it has capacity
 * for; leftover minutes that no same-day window can hold are dropped (V1 horizon).
 */
export function placeTasks(tasks: PendingTask[], windows: OpenWindow[]): PlacedChunk[] {
  const sorted = sortTasksForPlacement(tasks);
  const chrono = [...windows].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const remaining = new Map(chrono.map((w) => [w.id, w.end - w.start]));
  const chunks: PlacedChunk[] = [];

  for (const task of sorted) {
    let need = task.estimatedMinutes;
    if (need <= 0) continue;

    // 1) First-fit: earliest window that holds the WHOLE task.
    const whole = chrono.find((w) => (remaining.get(w.id) ?? 0) >= need);
    if (whole) {
      remaining.set(whole.id, (remaining.get(whole.id) ?? 0) - need);
      chunks.push({ windowId: whole.id, taskId: task.id, title: task.title, minutes: need });
      continue;
    }

    // 2) Too big for any single window: split across the LARGEST available windows,
    //    carrying the remainder forward until the task is placed or windows run out.
    const byCapacity = chrono
      .filter((w) => (remaining.get(w.id) ?? 0) > 0)
      .sort(
        (a, b) =>
          (remaining.get(b.id) ?? 0) - (remaining.get(a.id) ?? 0) || a.start - b.start,
      );
    for (const w of byCapacity) {
      if (need <= 0) break;
      const cap = remaining.get(w.id) ?? 0;
      const take = Math.min(cap, need);
      remaining.set(w.id, cap - take);
      chunks.push({ windowId: w.id, taskId: task.id, title: task.title, minutes: take });
      need -= take;
    }
    // Any leftover `need` here means every same-day window is full: dropped (V1 horizon).
  }

  return chunks;
}

/**
 * Deterministic post-process over a synthesized DailyPlan: place the day's real pending
 * tasks into the model's WORK blocks and write their titles onto `details.tasks`.
 *
 * Pure: (plan + pending tasks + calendar events) -> new plan. No mutation of the input.
 * A no-op (returns the plan untouched) when there are no pending tasks or the model
 * produced no work windows — so a task-free day keeps exactly what the model emitted.
 */
export function applyTaskPlacement(
  plan: DailyPlan,
  pendingTasks: PendingTask[],
  calendarEvents: CalendarEvent[],
): DailyPlan {
  if (pendingTasks.length === 0) return plan;

  // Candidate windows = the model's work blocks (where the task carrier lives).
  const candidates: OpenWindow[] = [];
  plan.blocks.forEach((block, i) => {
    if (block.details.blockType !== 'work') return;
    const start = hhmmToMinutes(block.startTime);
    const end = hhmmToMinutes(block.endTime, true);
    if (start === null || end === null || end <= start) return;
    candidates.push({ id: String(i), start, end });
  });
  if (candidates.length === 0) return plan;

  const windows = carveOpenWindows(candidates, calendarEventsToBusy(calendarEvents));
  const chunks = placeTasks(pendingTasks, windows);

  // Group placed titles back per originating block (strip the `::k` carve suffix),
  // order-preserving and de-duplicated within a block (a task bisected by an event can
  // land twice under the same block id).
  const titlesByBlock = new Map<string, string[]>();
  for (const chunk of chunks) {
    const blockId = chunk.windowId.split('::')[0]!;
    const list = titlesByBlock.get(blockId) ?? [];
    if (!list.includes(chunk.title)) list.push(chunk.title);
    titlesByBlock.set(blockId, list);
  }

  const blocks = plan.blocks.map((block, i) => {
    if (block.details.blockType !== 'work') return block;
    const titles = titlesByBlock.get(String(i)) ?? [];
    return { ...block, details: { ...block.details, tasks: titles } };
  });

  return { ...plan, blocks };
}
