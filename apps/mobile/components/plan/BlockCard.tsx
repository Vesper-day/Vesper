// BlockCard — per-block RN card for the mobile plan timeline (build chat 040).
//
// Renders one §9 PlanResponse block (camelCase, ISO time strings, server-computed
// `status` rendered AS-IS — never recomputed here): a per-type glyph, title, local
// time range, and a status treatment. Composes the Layer 4 / Chat 107 surface tokens
// via NativeWind (bg-surface, border-line-subtle, bronze active rail) — no off-system
// hex, no second styling pattern.
//
// SWIPE-TO-REVEAL AFFORDANCE (chat 040 scope): the card is wrapped in the gesture-handler
// ReanimatedSwipeable so a left-swipe reveals three action button SHELLS —
// complete / skip / reschedule. These are AFFORDANCE + SHELLS ONLY: onPress is a no-op
// and the buttons are visually disabled. The complete/skip/reschedule PATCH mutations are
// chat 042; block-detail expansion is chat 041 — neither is built here.
//
// NO icon primitive exists in @vesper/ui (tokens only), so — like web 039's BlockCard —
// the type marker is a unicode glyph; 041-V swaps for a real icon primitive when one ships.
import { View, Text } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { format as formatTime } from 'date-fns';
import { cn } from '../ui/utils';
import type { BlockType, EffectiveBlockStatus, PlanBlock } from './types';

/** Per-type unicode glyph (parity with web 039 — placeholder until the 041-V icon set). */
const BLOCK_GLYPH: Record<BlockType, string> = {
  work: '💼',
  fitness: '🏋',
  nutrition: '🍽',
  sleep: '🌙',
  errands: '🧾',
  medication: '💊',
  finance: '💰',
  focus: '🎯',
  commute: '🚶',
  custom: '•',
};

interface StatusTreatment {
  label: string;
  /** Title text tone. */
  titleClass: string;
  /** Small status label tone. */
  labelClass: string;
}

const STATUS_TREATMENT: Record<EffectiveBlockStatus, StatusTreatment> = {
  scheduled: { label: 'Scheduled', titleClass: 'text-cream', labelClass: 'text-cream-muted' },
  in_progress: { label: 'In progress', titleClass: 'text-cream', labelClass: 'text-bronze' },
  completed: { label: 'Done', titleClass: 'text-cream-faint line-through', labelClass: 'text-cream-faint' },
  skipped: { label: 'Skipped', titleClass: 'text-cream-faint', labelClass: 'text-cream-faint' },
  rescheduled: { label: 'Rescheduled', titleClass: 'text-cream-muted', labelClass: 'text-cream-muted' },
};

/** ISO instant → device-local "HH:mm" (matches tasks.tsx / web time rendering). */
function timeLabel(iso: string): string {
  return formatTime(new Date(iso), 'HH:mm');
}

interface ActionShellProps {
  label: string;
  toneClass: string;
}

/**
 * A revealed action button SHELL. Disabled + no-op by design (chat 042 wires the PATCH).
 * accessibilityState.disabled keeps it out of the tab order / announced as disabled.
 */
function ActionShell({ label, toneClass }: ActionShellProps): React.JSX.Element {
  return (
    <View
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      className={cn('w-20 items-center justify-center border-l border-line-subtle', toneClass)}
    >
      <Text className="text-xs font-medium text-cream-muted">{label}</Text>
    </View>
  );
}

/** The reveal panel: three shells, no mutation wired (042). */
function RightActions(): React.JSX.Element {
  return (
    <View className="flex-row">
      <ActionShell label="Complete" toneClass="bg-elevated" />
      <ActionShell label="Skip" toneClass="bg-elevated" />
      <ActionShell label="Reschedule" toneClass="bg-elevated" />
    </View>
  );
}

export interface BlockCardProps {
  block: PlanBlock;
}

export function BlockCard({ block }: BlockCardProps): React.JSX.Element {
  const treatment = STATUS_TREATMENT[block.status];
  const active = block.status === 'in_progress';

  return (
    <ReanimatedSwipeable
      renderRightActions={RightActions}
      overshootRight={false}
      rightThreshold={40}
      containerStyle={{ borderRadius: 12 }}
    >
      <View
        className={cn(
          'flex-row items-start gap-3 border border-line-subtle bg-surface px-4 py-3',
          active && 'border-l-2 border-l-bronze',
        )}
        style={{ borderRadius: 12 }}
        accessibilityRole="summary"
        accessibilityLabel={`${block.title}, ${timeLabel(block.startTime)} to ${timeLabel(block.endTime)}, ${treatment.label}`}
      >
        <Text className="text-base" accessibilityElementsHidden>
          {BLOCK_GLYPH[block.blockType]}
        </Text>
        <View className="min-w-0 flex-1">
          <Text className={cn('text-sm font-medium', treatment.titleClass)} numberOfLines={1}>
            {block.title}
          </Text>
          <View className="mt-0.5 flex-row items-center gap-2">
            <Text className="font-mono text-xs text-cream-faint">
              {timeLabel(block.startTime)}–{timeLabel(block.endTime)}
            </Text>
            <Text className={cn('text-xs', treatment.labelClass)}>{treatment.label}</Text>
          </View>
        </View>
      </View>
    </ReanimatedSwipeable>
  );
}
