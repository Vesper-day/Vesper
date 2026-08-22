// Pure resolution helpers behind the mobile over-commit prompt (Chat 056).
//
// Mobile twin of apps/web/components/plan/overCommitResolution.ts. DUPLICATED per
// surface following the 040 / 057 duplicate-vs-share precedent (the mobile
// buildPrioritiesSubmission twin): the bare @vesper/shared barrel transitively pulls
// server-only code (db -> postgres) that must never reach the mobile bundle, and this
// logic reads the mobile-local PlanBlock mirror rather than a web module (mobile has no
// apps/web dependency). The COPY itself is NOT duplicated — both surfaces render the
// same strings from the client-safe @vesper/shared/copy subpath.
//
// No react-native import, so this is safe to unit-test under the node vitest env
// without an RN mock (planViewHelpers.ts convention).
//
// MUTATION SURFACE (Chat 056 determination): the chat-027 PATCH
// /api/v1/blocks/[blockId] with `status: 'rescheduled'` — a live block_status_enum
// value. The chat-029 batch reorder carries only {id, displayOrder} and cannot express
// a status change. Deferring is a BLOCK-status change only: `blocks` has no FK to
// `tasks` (the join runs through the WORK variant's `details.tasks` id array), and a
// deferred task is not completed, so the task row is untouched and re-enters tomorrow's
// placement as a normal pending task.

import type { PlanBlock } from './types';

/** The user's decision for one conflicting item. */
export type OverCommitChoice = 'keep' | 'defer';

/** One conflicting item, as the reflow engine's UnplaceableItem reaches the UI. */
export interface OverCommitItem {
  /** The tasks-row uuid, from the work block's `details.tasks` (never the title). */
  taskId: string;
  title: string;
  /** Minutes the day cannot hold for this task. */
  unplacedMinutes: number;
  /** Every block on today's plan carrying this task id. A split task spans several. */
  blockIds: string[];
}

export interface ResolutionInput {
  items: OverCommitItem[];
  /** taskId -> choice. An absent key means the user has not decided yet. */
  selections: Record<string, OverCommitChoice>;
  /** The chat-027 OCC token. Null until the §9 GET exposes it (Chat 056 FLAG). */
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
 * Only the WORK variant has a task array (`focus` is a notes-only generic variant with
 * none), so non-work blocks never match. `details` is an opaque jsonb object on the §9
 * wire, so the array is read defensively.
 */
export function collectTaskBlockIds(blocks: readonly PlanBlock[], taskId: string): string[] {
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
 * Returns ok:false (and NO patches) until every listed item has a choice, so the prompt
 * renders a disabled confirm and fires nothing while the user is deciding (PRD §4.1:
 * the engine "holds all items in their current state"). Only deferred items produce
 * writes — keeping an item means leaving it exactly as it is.
 */
export function buildOverCommitResolution(input: ResolutionInput): ResolutionResult {
  const undecided = input.items.some((item) => input.selections[item.taskId] === undefined);
  if (undecided) return { ok: false, reason: 'incomplete' };

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
