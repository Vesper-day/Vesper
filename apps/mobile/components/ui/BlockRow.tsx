// BlockRow — RN plan-block row primitive (Layer 4 / Chat 107), mobile twin of the
// web BlockRow. radius-lg plan-block treatment, mono time, optional bronze active
// rail (the single accent). Renders a block, never a grade/score/streak — no such
// field exists by construction. NativeWind tokens only.
import { View, Text } from 'react-native';
import { cn } from './utils';

export interface BlockRowProps {
  time?: string;
  title: string;
  meta?: string;
  /** Bronze leading rail — marks the active/now block. At most one per plan. */
  active?: boolean;
  className?: string;
}

export function BlockRow({ time, title, meta, active = false, className }: BlockRowProps) {
  return (
    <View
      className={cn(
        'flex-row items-start gap-3 rounded-lg border border-line-subtle bg-surface px-4 py-3',
        active && 'border-l-2 border-l-bronze',
        className,
      )}
    >
      {time != null && <Text className="font-mono text-sm text-cream-faint">{time}</Text>}
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium text-cream" numberOfLines={1}>
          {title}
        </Text>
        {meta != null && (
          <Text className="mt-0.5 text-xs text-cream-muted" numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>
    </View>
  );
}
