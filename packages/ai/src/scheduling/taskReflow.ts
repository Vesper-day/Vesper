// Mid-day task reflow + over-commit detection (Chat 056).
//
// PURE + OFFLINE, mirroring taskPlacement.ts (Chat 055): no I/O, no DB, no model
// call, no clock — `now` is injected. Given the task chunks a new calendar event
// displaced, the day's remaining candidate windows, and the day's calendar events,
// it either resolves the day SILENTLY (new placements) or returns the explicit
// UNPLACEABLE set that drives the single over-commit prompt.
//
// CONTRACT (PRD §6.1 / §4.1)
//   silent      a displaced chunk reflows to the next available opening within the
//               task's deadline window, provided a resolution exists.
//   over_commit when the day no longer holds enough open time for all committed task
//               work within deadline constraints, NOTHING is silently deprioritized.
//               The engine holds every item in its current state and surfaces ONE
//               prompt listing the conflicting items. `placements` is empty on this
//               branch by design: "holds all items in their current state" means the
//               caller applies nothing until the user chooses.
//
// THE 055 DROP RULE, INVERTED (the whole point of this module)
//   placeTasks' V1 rule is that once same-day windows are exhausted the remainder is
//   DROPPED (single-day horizon). placeTasks does NOT return that remainder — it just
//   stops filling. This chat's contract is that a committed item is NEVER silently
//   dropped, so we recover the remainder by CONSERVATION (minutes needed minus minutes
//   placed) and return it explicitly. taskPlacement.ts is untouched: no second
//   placement algorithm, no second window carver, no second sort.
//
// REUSED UNCHANGED from taskPlacement.ts:
//   sortTasksForPlacement  the priority-DESC -> deadline-ASC-nulls-last stable sort
//   placeTasks             the greedy first-fit / largest-window split arithmetic
//   carveOpenWindows       interval subtraction (used for busy events, for the
//                          now/deadline bound, and for consuming filled capacity)
//   calendarEventsToBusy   event -> busy interval mapping (all-day events skipped)
//   OpenWindow             the {id,start,end} minutes-from-midnight convention
//
// DEADLINE = SILENCE. A reflow is only "silent" if it violates no deadline. We enforce
// that by CONSTRUCTION rather than by checking after the fact: before placing a task we
// bound its eligible windows to [now, deadlineCutoff) by subtracting the outside-bounds
// intervals through carveOpenWindows. A chunk that would only fit past its deadline
// therefore never places — it falls out as unplaced minutes and surfaces.
//
// CHUNKS ARE KEYED BY TASK ID, NEVER BY TITLE (055's carrier rule). The same id across
// more than one work block is ONE split task, so displaced chunks are summed per id
// before placement and the task reflows as a single unit.
//
// CALL SEAM (Chat 067, not built — this module is wired into NOTHING).
//   Precedence is 067-FIRST / 056-SECOND. When a calendar sync delivers a new or
//   modified event, 067's conflict resolution runs FIRST: AI-placed blocks overlapping
//   the new event are set to `rescheduled` and removed from the visible plan. THEN 067
//   calls reflowDisplacedChunks() with the task chunks those removed blocks carried.
//   This module never observes a sync, a block row, or a status write.

import type { CalendarEvent, PendingTask } from '../context/planContext';

import {
  calendarEventsToBusy,
  carveOpenWindows,
  placeTasks,
  sortTasksForPlacement,
  type BusyInterval,
  type OpenWindow,
  type PlacedChunk,
} from './taskPlacement';

const MINUTES_IN_DAY = 24 * 60;

/** One displaced chunk: the task id it carried and the minutes it held. */
export interface DisplacedChunk {
  /** The tasks-row uuid from the work block's `details.tasks` (never the title). */
  taskId: string;
  minutes: number;
}

/** A task the engine could not fully reflow. Drives the over-commit prompt's item list. */
export interface UnplaceableItem {
  taskId: string;
  title: string;
  /** Total displaced minutes for this task (split chunks summed). */
  displacedMinutes: number;
  /** Minutes that WOULD have fit. Never applied on the over_commit branch. */
  placeableMinutes: number;
  /** Minutes with nowhere to go today within the deadline. Always > 0. */
  unplacedMinutes: number;
  deadline: string | null;
  priority: string;
}

export interface ReflowInput {
  /** The plan's local day, YYYY-MM-DD. Compared against each task's deadline date. */
  planDate: string;
  /** Injected clock: minutes from midnight. Openings before `now` are not available. */
  now: number;
  /** The chunks the new event knocked out (067 supplies these from the removed blocks). */
  displacedChunks: DisplacedChunk[];
  /** The day's remaining plannable windows (the surviving work blocks). */
  candidateWindows: OpenWindow[];
  /** The day's calendar events, INCLUDING the new one. Carved out before placement. */
  calendarEvents: CalendarEvent[];
  /** Task metadata (deadline, priority, title) for the displaced ids. */
  pendingTasks: PendingTask[];
}

export type ReflowResult =
  | {
      resolution: 'silent';
      /** Where each displaced chunk lands. `windowId` prefixes back to its candidate id. */
      placements: PlacedChunk[];
      unplaceable: [];
    }
  | {
      resolution: 'over_commit';
      /** Empty by contract: the engine holds every item until the user chooses. */
      placements: [];
      /** Every task that cannot fully fit. Returned in FULL; nothing is dropped. */
      unplaceable: UnplaceableItem[];
    };

/**
 * The latest minute-from-midnight on `planDate` at which this task's work may still
 * land. A deadline on a later date (or absent) imposes no same-day bound; a deadline
 * already past leaves no eligible window at all.
 */
function deadlineCutoff(deadline: string | null, planDate: string): number {
  if (deadline === null) return MINUTES_IN_DAY;

  const deadlineDate = deadline.slice(0, 10);
  if (deadlineDate > planDate) return MINUTES_IN_DAY;
  if (deadlineDate < planDate) return 0; // already overdue: nothing today can satisfy it

  // Deadline falls ON the plan date: bound by its wall-clock time. A date-only
  // deadline names no hour, so it binds at end-of-day rather than at midnight.
  const tIndex = deadline.indexOf('T');
  if (tIndex === -1) return MINUTES_IN_DAY;
  const match = /^(\d{2}):(\d{2})/.exec(deadline.slice(tIndex + 1));
  if (!match) return MINUTES_IN_DAY;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return MINUTES_IN_DAY;
  return h * 60 + m;
}

/** The intervals a task may NOT use: everything before `now` and everything past its deadline. */
function outOfBoundsIntervals(now: number, cutoff: number): BusyInterval[] {
  const bounds: BusyInterval[] = [];
  if (now > 0) bounds.push({ start: 0, end: Math.min(now, MINUTES_IN_DAY) });
  if (cutoff < MINUTES_IN_DAY) bounds.push({ start: Math.max(cutoff, 0), end: MINUTES_IN_DAY });
  return bounds;
}

/**
 * Reflow the displaced chunks into the day's remaining openings.
 *
 * Returns `silent` only when EVERY displaced task fits whole, after `now`, within its
 * deadline. Otherwise returns `over_commit` with the full unplaceable set and applies
 * nothing — that set IS the over-commit prompt's item list.
 *
 * Pure: no mutation of any input.
 */
export function reflowDisplacedChunks(input: ReflowInput): ReflowResult {
  // Group displaced chunks by task id: a split task's chunks are ONE task's work.
  const displacedByTask = new Map<string, number>();
  for (const chunk of input.displacedChunks) {
    if (chunk.minutes <= 0) continue;
    displacedByTask.set(chunk.taskId, (displacedByTask.get(chunk.taskId) ?? 0) + chunk.minutes);
  }

  // Zero displacement: nothing moved, nothing to surface.
  if (displacedByTask.size === 0) {
    return { resolution: 'silent', placements: [], unplaceable: [] };
  }

  const metaById = new Map(input.pendingTasks.map((task) => [task.id, task]));
  const unplaceable: UnplaceableItem[] = [];
  const reflowTasks: PendingTask[] = [];

  for (const [taskId, minutes] of displacedByTask) {
    const meta = metaById.get(taskId);
    if (!meta) {
      // No metadata means we cannot verify this task's deadline, so we cannot claim a
      // silent resolution for it. Surface it rather than place it blind or drop it.
      unplaceable.push({
        taskId,
        title: '',
        displacedMinutes: minutes,
        placeableMinutes: 0,
        unplacedMinutes: minutes,
        deadline: null,
        priority: 'medium',
      });
      continue;
    }
    // The task reflows only the minutes it lost, not its whole original estimate.
    reflowTasks.push({ ...meta, estimatedMinutes: minutes });
  }

  // Subtract the day's fixed events (including the new one) from the candidate windows.
  let remaining = carveOpenWindows(
    input.candidateWindows,
    calendarEventsToBusy(input.calendarEvents),
  );

  const placements: PlacedChunk[] = [];

  // 055's sort decides who gets the scarce openings first: priority DESC, deadline ASC.
  for (const task of sortTasksForPlacement(reflowTasks)) {
    const cutoff = deadlineCutoff(task.deadline, input.planDate);

    // Bound this task's windows to [now, cutoff) by subtracting everything outside —
    // the same carver, so a past-deadline fit is impossible by construction.
    const eligible = carveOpenWindows(remaining, outOfBoundsIntervals(input.now, cutoff));
    const chunks = placeTasks([task], eligible);
    const placed = chunks.reduce((sum, chunk) => sum + chunk.minutes, 0);

    if (placed < task.estimatedMinutes) {
      // placeTasks silently dropped the remainder (V1 horizon). Recover it by
      // conservation and surface it: this is the over-commit signal.
      unplaceable.push({
        taskId: task.id,
        title: task.title,
        displacedMinutes: task.estimatedMinutes,
        placeableMinutes: placed,
        unplacedMinutes: task.estimatedMinutes - placed,
        deadline: task.deadline,
        priority: task.priority,
      });
      continue;
    }

    placements.push(...chunks);

    // Consume the capacity this task just took so the next task cannot reuse it.
    // placeTasks tracks capacity per window without positions, and only ONE task runs
    // per call, so each chunk occupies the head of its window.
    const eligibleById = new Map(eligible.map((window) => [window.id, window]));
    const filled: BusyInterval[] = [];
    for (const chunk of chunks) {
      const window = eligibleById.get(chunk.windowId);
      if (!window) continue;
      filled.push({ start: window.start, end: window.start + chunk.minutes });
    }
    remaining = carveOpenWindows(remaining, filled);
  }

  if (unplaceable.length > 0) {
    // Over-commit: hold everything, apply nothing, surface the full conflicting set.
    return { resolution: 'over_commit', placements: [], unplaceable };
  }

  return { resolution: 'silent', placements, unplaceable: [] };
}
