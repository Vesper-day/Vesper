// OverCommitPrompt — the single butler-voice over-commit prompt (Chat 056, mobile),
// hosted in the day view (apps/mobile/app/(tabs)/plan.tsx). RN parity with the web
// twin (apps/web/components/plan/OverCommitPrompt.tsx).
//
// PRD §1: this is "the only interruption the engine initiates for scheduling
// conflicts." ONE prompt listing the conflicting items, ONE confirm. Never a per-item
// cascade: each item takes a keep/defer choice inline, and a single action settles them
// together. No scorekeeping, streak, or progress framing on this surface.
//
// COPY: sourced from the client-safe `@vesper/shared/copy` subpath — the same strings
// the web prompt renders, never inlined, never the bare @vesper/shared barrel (which
// pulls db -> postgres into the bundle). Expo SDK 54's tsconfig.base resolves with
// moduleResolution 'bundler', so the package's `exports` subpath resolves here (the
// same way hooks/usePlanRealtime imports '@vesper/shared/realtime').
//
// UNRESOLVED STATE IS CLIENT-SIDE ONLY (Chat 056 determination). block_status_enum has
// no `unresolved` value and `blocks` has no conflict flag (both confirmed against the
// applied schema), so no migration was authored. PRD §4.1's "holds all items in their
// current state" reads as: NOTHING is written when the conflict surfaces. This prompt is
// a transient surface over the already-fetched ['plan', planDate] data; items stay
// visually distinguished until the user chooses, and the first write is the confirm.
//
// TRIGGER SEAM (Chat 067, not built): `items` is a prop. Nothing displaces a task chunk
// until 067's calendar-sync conflict resolution runs, so the day view passes an empty
// array today and this renders null. Precedence is 067-FIRST then 056-SECOND.
//
// NO SECOND PLAN QUERY / CLIENT: this component reads and writes nothing on its own.
import { useCallback, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import {
  OVER_COMMIT_CONFIRM_LABEL,
  OVER_COMMIT_DEFER_LABEL,
  OVER_COMMIT_ITEMS_HEADING,
  OVER_COMMIT_KEEP_LABEL,
  OVER_COMMIT_PROMPT_LINE,
  overCommitItemLine,
} from '@vesper/shared/copy';
import { Button, ButlerLine } from '../ui';
import {
  buildOverCommitResolution,
  type BlockPatch,
  type OverCommitChoice,
  type OverCommitItem,
} from './overCommitHelpers';

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

  // Recomputed as the user decides. Until every item has a choice this is ok:false
  // with no patches, so the confirm is disabled and nothing fires.
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
    <View
      accessibilityLabel="Over-commit prompt"
      className="mb-4 rounded-lg border border-line-subtle bg-surface px-4 py-3"
    >
      <ButlerLine>{OVER_COMMIT_PROMPT_LINE}</ButlerLine>

      <Text className="mt-3 text-xs uppercase tracking-wider text-cream-faint">
        {OVER_COMMIT_ITEMS_HEADING}
      </Text>

      <View className="mt-2">
        {items.map((item) => {
          const choice = selections[item.taskId];
          return (
            <View
              key={item.taskId}
              // Unresolved items stay visually distinguished until the user chooses
              // (PRD §4.1). The dashed marker clears once this item has a decision.
              className={
                choice === undefined
                  ? 'mb-2 rounded-md border border-dashed border-bronze/60 px-3 py-2'
                  : 'mb-2 rounded-md border border-line-subtle px-3 py-2'
              }
            >
              <Text className="text-sm text-cream">
                {overCommitItemLine(item.title, item.unplacedMinutes)}
              </Text>
              <View className="mt-2 flex-row items-center gap-2">
                <Button
                  title={OVER_COMMIT_KEEP_LABEL}
                  variant={choice === 'keep' ? 'primary' : 'secondary'}
                  onPress={() => choose(item.taskId, 'keep')}
                />
                <Button
                  title={OVER_COMMIT_DEFER_LABEL}
                  variant={choice === 'defer' ? 'primary' : 'secondary'}
                  onPress={() => choose(item.taskId, 'defer')}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* ONE action settles every item. Inert until each has a choice. */}
      <View className="mt-1 flex-row justify-end">
        <Button
          title={OVER_COMMIT_CONFIRM_LABEL}
          variant="primary"
          onPress={handleConfirm}
          disabled={!resolution.ok}
        />
      </View>
    </View>
  );
}
