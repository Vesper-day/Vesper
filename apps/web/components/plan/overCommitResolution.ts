// Pure resolution builder behind the over-commit prompt (Chat 056, web).
//
// Extracted from OverCommitPrompt.tsx following the 054-W TaskForm buildSubmission
// precedent: there is no @testing-library/react on web, so the component's decision
// logic lives here and is asserted without a DOM render.
//
// MUTATION SURFACE (Chat 056 determination): the chat-027 PATCH
// /api/v1/blocks/[blockId] with `status: 'rescheduled'`. The chat-029 batch reorder
// endpoint carries ONLY {id, displayOrder} (see its ReorderRequestSchema) and cannot
// express a status change, so a batch call cannot defer anything. Neither route is
// edited here and no new route is authored: deferring N blocks issues N PATCHes.
// That is not a per-item cascade — the user answers ONE prompt, and these writes are
// the single consequence of that one confirmed choice.
//
// STATUS VOCABULARY: `rescheduled` is a live block_status_enum value, confirmed
// against the applied schema (scheduled, in_progress, completed, skipped,
// rescheduled). The PRD's "pending / complete" wording is §4.1 prose that the §3 enum
// supersedes. `rescheduled` is also exactly what chat 067 writes when it clears blocks
// that a new event overlaps, so deferral and displacement leave the same trace.
//
// DEFER = A BLOCK-STATUS CHANGE ONLY, NOT A TASK-ROW CHANGE. `blocks` has no FK to
// `tasks`; the join runs through the WORK variant's `details.tasks` id array. Moving a
// chunk to tomorrow removes today's block from the plan, and the task row is untouched:
// its status stays 'pending' and it re-enters tomorrow's placement through the normal
// pending-task read. Writing the task row would be wrong — a deferred task is not
// completed, and there is no 'deferred' value in task_status_enum.
//
// NOTHING IS WRITTEN UNTIL THE USER CHOOSES (PRD §4.1: the engine "holds all items in
// their current state"). buildOverCommitResolution returns ok:false with zero patches
// while any listed item is still unchosen, so the caller has nothing to fire.

/** The user's decision for one conflicting item. */
export type OverCommitChoice = 'keep' | 'defer';

/** One conflicting item, as the reflow engine's UnplaceableItem reaches the UI. */
export interface OverCommitItem {
  /** The tasks-row uuid, from the work block's `details.tasks` (never the title). */
  taskId: string;
  title: string;
  /** Minutes the day cannot hold for this task. */
  unplacedMinutes: number;
  /**
   * Every block on today's plan carrying this task id. A split task spans more than
   * one, and deferring the task defers all of its chunks together.
   */
  blockIds: string[];
}

export interface ResolutionInput {
  items: OverCommitItem[];
  /** taskId -> choice. An absent key means the user has not decided yet. */
  selections: Record<string, OverCommitChoice>;
  /** The chat-027 OCC token. Threaded from the previous response on each PATCH. */
  planUpdatedAt: string | null;
}

/** One chat-027 PATCH /blocks/[blockId] call. */
export interface BlockPatch {
  blockId: string;
  body: {
    status: 'rescheduled';
    planUpdatedAt: string;
  };
}

export type ResolutionResult =
  | { ok: false; reason: 'incomplete' | 'no-token' }
  | { ok: true; patches: BlockPatch[] };

/**
 * Collect the blocks on today's plan that carry a given task id.
 *
 * The WORK variant is the only one with a task array (`focus` is a notes-only generic
 * variant with none), so non-work blocks never match. Reads the §9 GET block shape
 * defensively: `details` arrives as an opaque jsonb object on the wire.
 */
export function collectTaskBlockIds(
  blocks: ReadonlyArray<{ id: string; details: Record<string, unknown> }>,
  taskId: string,
): string[] {
  const ids: string[] = [];
  for (const block of blocks) {
    const tasks = block.details.tasks;
    if (!Array.isArray(tasks)) continue;
    if (tasks.includes(taskId)) ids.push(block.id);
  }
  return ids;
}

/**
 * Map the user's selection onto the PATCH payloads that resolve the day.
 *
 * Returns ok:false (and NO patches) until every listed item has a choice, so the
 * prompt can render a disabled confirm and fire nothing while the user is deciding.
 * Only deferred items produce writes: keeping an item today means leaving it exactly
 * as it is, which is no write at all.
 */
export function buildOverCommitResolution(input: ResolutionInput): ResolutionResult {
  const undecided = input.items.some((item) => input.selections[item.taskId] === undefined);
  if (undecided) return { ok: false, reason: 'incomplete' };

  // OCC token missing: the §9 GET does not expose planUpdatedAt (Chat 056 FLAG), so a
  // host that cannot supply it must not fire a PATCH that would 409 or write blind.
  if (input.planUpdatedAt === null) return { ok: false, reason: 'no-token' };

  const token = input.planUpdatedAt;
  const patches: BlockPatch[] = [];
  for (const item of input.items) {
    if (input.selections[item.taskId] !== 'defer') continue;
    for (const blockId of item.blockIds) {
      patches.push({ blockId, body: { status: 'rescheduled', planUpdatedAt: token } });
    }
  }

  return { ok: true, patches };
}
