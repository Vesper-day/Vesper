'use client';

// SmoothScroll — the rich-posture smooth-scroll provider (Design-Track Re-Overhaul
// / ADD-D). Wraps a scroll surface with Lenis (the smooth-scroll code library added
// by ADD-D) so long immersive surfaces (landing, scroll storytelling) scroll with
// eased inertia instead of the native step. It is a thin, self-contained wrapper:
// mount it high in a surface's tree; it drives Lenis on a rAF loop and tears it
// down on unmount.
//
// Reduced motion is MANDATORY here (ADD-D): when prefers-reduced-motion is set,
// Lenis is never constructed — the surface keeps native scrolling with zero
// inertia. The preference is read live via the shared useReducedMotion hook, so a
// mid-session change re-runs the effect and swaps behavior.
//
// No tokens are inlined; Lenis' own timing lives in the library. This composes a
// dependency rather than re-deriving scroll physics.
import * as React from 'react';
import Lenis from 'lenis';
import { useReducedMotion } from './motion';

export interface SmoothScrollProps {
  children: React.ReactNode;
}

export function SmoothScroll({ children }: SmoothScrollProps) {
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    // Reduced motion: do not construct Lenis — native scroll stands in (instant).
    if (reduceMotion) return;

    const lenis = new Lenis();
    let frame = 0;
    const raf = (time: number): void => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [reduceMotion]);

  return <>{children}</>;
}
