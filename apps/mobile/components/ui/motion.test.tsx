// Motion primitives (mobile) — band/spring durations read from tokens (no inline ms);
// reduced-motion yields instant (no entering animation). react-native + reanimated mocked.
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({ Pressable: 'Pressable', View: 'View' }));
vi.mock('react-native-reanimated', () => ({
  default: { View: 'Animated.View', createAnimatedComponent: (c: unknown) => c },
  FadeIn: { duration: (ms: number) => ({ __ms: ms }) },
  useSharedValue: (v: number) => ({ value: v }),
  useAnimatedStyle: (fn: () => unknown) => fn(),
  withSpring: (to: number, cfg: unknown) => ({ __spring: to, cfg }),
}));

import { Entrance, Interaction, bandDurationMs, springConfig } from './motion';

type Animated = { type: unknown; props: { entering?: { __ms: number }; className?: string } };

describe('motion tokens', () => {
  it('reads band durations from the token band midpoints (no hardcoded ms)', () => {
    expect(bandDurationMs('quick')).toBe(200); // (150+250)/2
    expect(bandDurationMs('considered')).toBe(400); // (300+500)/2
  });

  it('reads the spring config from the motion token', () => {
    expect(springConfig()).toEqual({ damping: 18, stiffness: 150 });
  });
});

describe('Entrance (mobile)', () => {
  it('enters over the band duration token by default', () => {
    const el = Entrance({ band: 'quick', className: 'x' }) as unknown as Animated;
    expect(el.props.entering?.__ms).toBe(200);
    expect(el.props.className).toBe('x');
  });

  it('reduced motion yields instant (no entering animation)', () => {
    const el = Entrance({ reduceMotion: true }) as unknown as Animated;
    expect(el.props.entering).toBeUndefined();
  });
});

describe('Interaction (mobile)', () => {
  it('renders an animated pressable with the passed className', () => {
    const el = Interaction({ className: 'y' }) as unknown as Animated;
    expect(el.type).toBe('Pressable');
    expect(el.props.className).toBe('y');
  });
});
