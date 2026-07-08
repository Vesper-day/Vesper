// BlockTimeline — vertical block list for the mobile plan day view (build chat 040).
//
// Orders the §9 PlanResponse blocks by startTime asc with displayOrder as the tiebreaker
// (the extracted, unit-tested blockSortComparator) and renders one swipe-enabled BlockCard
// per block. Hosts the per-block swipe rows (the BlockCards) and configures the Reanimated
// LAYOUT ANIMATION at THIS level: each row is an Animated.View with a spring layout
// transition, so when a Realtime broadcast reorders / reschedules a block the row SLIDES to
// its new position rather than jumping. Rows also fade in on first appearance.
//
// Motion reads the @vesper/ui spring token (damping 18 / stiffness 150) + band duration via
// the shared mobile motion helpers — never a hardcoded ms/stiffness. Reduced motion
// (AccessibilityInfo.isReduceMotionEnabled, via useReducedMotion) drops both the layout
// transition and the entrance to instant.
//
// Read-only render consumer: no mutations (042), no detail expansion (041), no drag-reorder
// (043). Renders against §9 PlanResponse only, never DailyPlanSchema.
import { useMemo } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { bandDurationMs, springConfig, useReducedMotion } from '../ui/motion';
import { BlockCard } from './BlockCard';
import { blockSortComparator } from './planViewHelpers';
import type { Plan } from './types';

export interface BlockTimelineProps {
  plan: Plan;
}

export function BlockTimeline({ plan }: BlockTimelineProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();

  const ordered = useMemo(
    () => [...plan.blocks].sort(blockSortComparator),
    [plan.blocks],
  );

  const spring = springConfig();
  const layout = reduceMotion
    ? undefined
    : LinearTransition.springify().damping(spring.damping).stiffness(spring.stiffness);

  return (
    <View className="gap-2" accessibilityRole="list">
      {ordered.map((block) => (
        <Animated.View
          key={block.id}
          layout={layout}
          entering={reduceMotion ? undefined : FadeIn.duration(bandDurationMs('quick'))}
        >
          <BlockCard block={block} />
        </Animated.View>
      ))}
    </View>
  );
}
