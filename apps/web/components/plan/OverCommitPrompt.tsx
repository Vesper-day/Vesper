'use client';

// OverCommitPrompt — the single butler-voice over-commit prompt (Chat 056, web),
// hosted in the day view (apps/web/app/(app)/plan/page.tsx).
//
// PRD §1: this is "the only interruption the engine initiates for scheduling
// conflicts." ONE prompt listing the conflicting items, ONE confirm. Never a per-item
// cascade: each item takes a keep/defer choice inline, and a single action settles them
// together. No scorekeeping, streak, or progress framing anywhere on this surface.
//
// COPY: sourced from the client-safe `@vesper/shared/copy` subpath so this component
// and its mobile twin render identical strings. Never the bare @vesper/shared barrel,
// which transitively pulls @vesper/db -> postgres into the client bundle. Nothing is
// inlined here.
//
// UNRESOLVED STATE IS CLIENT-SIDE ONLY (Chat 056 determination). block_status_enum has
// no `unresolved` value, `blocks` has no conflict flag, and the WORK variant of
// BlockDetailsSchema carries only {blockType, tasks, focusMode} — all confirmed against
// the applied schema. No migration was authored. PRD §4.1's "holds all items in their
// current state" reads as: NOTHING is written when the conflict surfaces. This prompt is
// a transient surface over the already-fetched ['plan', planDate] data, and the items
// stay visually distinguished here until the user chooses. The first write happens on
// confirm.
//
// TRIGGER SEAM (Chat 067, not built): `items` is a prop. Nothing displaces a task chunk
// until 067's calendar-sync conflict resolution runs, so the day view passes an empty
// array today and this renders null. 067 owns the trigger; precedence is 067-FIRST
// (overlapping blocks -> `rescheduled`, removed from the plan) then 056-SECOND (reflow
// the displacement; an unplaceable remainder becomes these items). This chat wires the
// engine into no sync path.
//
// NO SECOND PLAN QUERY / CLIENT: this component reads and writes nothing on its own.
// The host owns the ['plan', planDate] cache and hands down the items, the OCC token,
// and the confirm handler.
import { useCallback, useMemo, useState } from 'react';
import {
  OVER_COMMIT_CONFIRM_LABEL,
  OVER_COMMIT_DEFER_LABEL,
  OVER_COMMIT_ITEMS_HEADING,
  OVER_COMMIT_KEEP_LABEL,
  OVER_COMMIT_PROMPT_LINE,
  overCommitItemLine,
} from '@vesper/shared/copy';
import { Button, ButlerLine } from '@/components/ui';
import {
  buildOverCommitResolution,
  type BlockPatch,
  type OverCommitChoice,
  type OverCommitItem,
} from './overCommitResolution';

export interface OverCommitPromptProps {
  /** The conflicting items the reflow engine could not place. Empty -> renders null. */
  items: OverCommitItem[];
  /**
   * The chat-027 OCC token. The §9 GET does not expose planUpdatedAt (Chat 056 FLAG),
   * so this is null today and the confirm stays inert rather than firing a blind PATCH.
   */
  planUpdatedAt: string | null;
  /** Applies the resolution. The host owns the fetch + cache invalidation. */
  onResolve?: (patches: BlockPatch[]) => void;
}

export function OverCommitPrompt({
  items,
  planUpdatedAt,
  onResolve,
}: OverCommitPromptProps): React.JSX.Element | null {
  const [selections, setSelections] = useState<Record<string, OverCommitChoice>>({});

  const choose = useCallback((taskId: string, choice: OverCommitChoice) => {
    setSelections((current) => ({ ...current, [taskId]: choice }));
  }, []);

  // Recomputed as the user decides. Until every item has a choice this is
  // ok:false with no patches, so the confirm is disabled and nothing fires.
  const resolution = useMemo(
    () => buildOverCommitResolution({ items, selections, planUpdatedAt }),
    [items, selections, planUpdatedAt],
  );

  const handleConfirm = useCallback(() => {
    if (!resolution.ok) return;
    onResolve?.(resolution.patches);
  }, [resolution, onResolve]);

  // No conflict: the engine resolved the day silently and says nothing.
  if (items.length === 0) return null;

  return (
    <section
      className="mb-4 rounded-lg border border-line-subtle bg-surface px-4 py-3"
      aria-label="Over-commit prompt"
    >
      <ButlerLine>{OVER_COMMIT_PROMPT_LINE}</ButlerLine>

      <p className="mt-3 text-xs uppercase tracking-wider text-cream-faint">
        {OVER_COMMIT_ITEMS_HEADING}
      </p>

      <ul className="mt-2 space-y-2">
        {items.map((item) => {
          const choice = selections[item.taskId];
          return (
            <li
              key={item.taskId}
              // Unresolved items stay visually distinguished until the user chooses
              // (PRD §4.1). The marker clears once this item has a decision.
              data-unresolved={choice === undefined ? 'true' : 'false'}
              className={
                choice === undefined
                  ? 'flex items-center justify-between gap-3 rounded-md border border-dashed border-bronze/60 px-3 py-2'
                  : 'flex items-center justify-between gap-3 rounded-md border border-line-subtle px-3 py-2'
              }
            >
              <span className="text-sm text-cream">
                {overCommitItemLine(item.title, item.unplacedMinutes)}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant={choice === 'keep' ? 'primary' : 'secondary'}
                  onClick={() => choose(item.taskId, 'keep')}
                  aria-pressed={choice === 'keep'}
                >
                  {OVER_COMMIT_KEEP_LABEL}
                </Button>
                <Button
                  variant={choice === 'defer' ? 'primary' : 'secondary'}
                  onClick={() => choose(item.taskId, 'defer')}
                  aria-pressed={choice === 'defer'}
                >
                  {OVER_COMMIT_DEFER_LABEL}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex justify-end">
        {/* ONE action settles every item. Inert until each has a choice. */}
        <Button variant="primary" onClick={handleConfirm} disabled={!resolution.ok}>
          {OVER_COMMIT_CONFIRM_LABEL}
        </Button>
      </div>
    </section>
  );
}
