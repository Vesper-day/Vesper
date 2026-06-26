'use client';

// Motion primitives (web) — Layer 4 / Chat 107a. A small reusable set of entrance +
// interaction wrappers plus a reduced-motion hook, so later screens never inline a
// one-off animation. Mechanism: CSS transitions driven by the @vesper/ui token
// classes the Tailwind preset emits — `duration-quick` / `duration-considered`
// (band midpoints), `duration-instant` (reduced-motion fallback), and the
// `ease-standard-out` curve. No motion library is a web dep, so this composes the
// preset rather than adding one. Never inlines an ms value or a bezier.
//
// Reduced motion: globals.css already collapses every transition under
// `prefers-reduced-motion` to instant. These primitives ALSO read the preference
// (useReducedMotion) so they can swap the duration token AND drop the transform
// before paint — belt-and-suspenders with the global collapse.
import * as React from 'react';
import { cn } from '@/lib/utils';

export type MotionBand = 'quick' | 'considered';

// Quick = taps / toggles / focus (150-250ms band); Considered = reveals / sheets /
// expansions (300-500ms band). Map to the preset's token duration utility.
const BAND_DURATION: Record<MotionBand, string> = {
  quick: 'duration-quick',
  considered: 'duration-considered',
};

/**
 * Pure: the token duration utility class for a band, collapsing to the instant
 * token when reduced motion is on. Reads the band tokens via the preset class
 * names — never a hardcoded ms. Exported so it can be asserted directly.
 */
export function motionDurationClass(band: MotionBand, reduceMotion: boolean): string {
  return reduceMotion ? 'duration-instant' : BAND_DURATION[band];
}

/**
 * prefers-reduced-motion listener. SSR-safe: returns false until mounted, then
 * tracks the media query live.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent): void => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export interface EntranceProps extends React.HTMLAttributes<HTMLDivElement> {
  band?: MotionBand;
  /** Pass the result of useReducedMotion() (or force it). Defaults to false. */
  reduceMotion?: boolean;
}

/**
 * Entrance — fades + rises children in on mount over the band duration with the
 * standard-out (entry) easing. reduceMotion shows them immediately at the instant
 * token with no transform.
 */
export function Entrance({
  band = 'considered',
  reduceMotion = false,
  className,
  children,
  ...props
}: EntranceProps) {
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => setShown(true), []);
  const visible = shown || reduceMotion;
  return (
    <div
      className={cn(
        'transition-[opacity,transform] ease-standard-out',
        motionDurationClass(band, reduceMotion),
        visible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface InteractionProps extends React.HTMLAttributes<HTMLDivElement> {
  band?: MotionBand;
  reduceMotion?: boolean;
}

/**
 * Interaction — press feedback: a Quick-band scale-in on :active over the token
 * duration + standard-out easing. reduceMotion drops the scale.
 */
export function Interaction({
  band = 'quick',
  reduceMotion = false,
  className,
  children,
  ...props
}: InteractionProps) {
  return (
    <div
      className={cn(
        'transition-transform ease-standard-out',
        motionDurationClass(band, reduceMotion),
        reduceMotion ? '' : 'active:scale-95',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
