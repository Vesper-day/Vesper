// Motion primitives (mobile) — Layer 4 / Chat 107a. The RN twin of the web motion
// set: an entrance + an interaction wrapper plus reduced-motion helpers, so later
// screens never inline a one-off animation. Mechanism: react-native-reanimated (a
// live mobile dep) — declarative `FadeIn` for timed entrances (band duration) and a
// spring for press feedback (the motion spring token, damping 18 / stiffness 150).
// Durations + spring are read from the @vesper/ui `motion` token object — never a
// hardcoded ms or stiffness.
//
// Reduced motion: callers feed `reduceMotion` from useReducedMotion() (which reads
// AccessibilityInfo.isReduceMotionEnabled). When true, the entrance has no entering
// animation (instant) and the press writes the target value with no spring (instant).
import { useEffect, useState, type ReactNode } from 'react';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { AccessibilityInfo, Pressable, type PressableProps } from 'react-native';
import { motion } from '@vesper/ui';

export type MotionBand = 'quick' | 'considered';

/**
 * Reduced-motion preference via AccessibilityInfo.isReduceMotionEnabled, tracked
 * live. Feed the result into Entrance/Interaction's `reduceMotion` so they swap to
 * the instant path. (Mobile mirror of the web useReducedMotion + globals.css
 * prefers-reduced-motion collapse.)
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/**
 * Band duration in ms, read from the token band [min,max] and taken at its midpoint
 * (quick = 200ms from 150-250; considered = 400ms from 300-500). Never a hardcoded
 * number — derived from motion.duration.bands.
 */
export function bandDurationMs(band: MotionBand): number {
  const [min, max] = motion.duration.bands[band];
  return (min + max) / 2;
}

/** Interactive spring config straight from the motion token (damping 18 / stiffness 150). */
export function springConfig(): { damping: number; stiffness: number } {
  return { damping: motion.spring.damping, stiffness: motion.spring.stiffness };
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface EntranceProps {
  band?: MotionBand;
  reduceMotion?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Entrance — fades children in over the band duration on mount. reduceMotion drops
 * the entering animation entirely (instant appearance).
 */
export function Entrance({ band = 'considered', reduceMotion = false, className, children }: EntranceProps) {
  const entering = reduceMotion ? undefined : FadeIn.duration(bandDurationMs(band));
  return (
    <Animated.View entering={entering} className={className}>
      {children}
    </Animated.View>
  );
}

export interface InteractionProps extends Omit<PressableProps, 'children'> {
  reduceMotion?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Interaction — press feedback: springs a subtle scale on press-in and back on
 * press-out using the spring token. reduceMotion writes the scale instantly (no
 * spring).
 */
export function Interaction({
  reduceMotion = false,
  className,
  children,
  onPressIn,
  onPressOut,
  ...props
}: InteractionProps) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const to = (next: number): void => {
    scale.value = reduceMotion ? next : withSpring(next, springConfig());
  };
  return (
    <AnimatedPressable
      className={className}
      style={style}
      onPressIn={(e) => {
        to(0.97);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        onPressOut?.(e);
      }}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
