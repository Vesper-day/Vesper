import type { Config } from 'tailwindcss';
import { colors, borderRadius, typography, motion } from './tokens';

/**
 * Shared Vesper Tailwind preset. Every value is built from ./tokens.ts (the
 * single source of truth) — no hexes, sizes, radii, or durations are duplicated
 * here. Extended once and consumed by apps/web (Tailwind) and apps/mobile
 * (NativeWind) so the same utility class names resolve identically on both.
 *
 * Utilities produced:
 *   bg-/text-/border-  espresso surface elevated cream cream-muted cream-faint
 *                      bronze oxblood line-subtle line-strong success warning error
 *   rounded-           none sm md lg xl 2xl full  (Layer 4 radii)
 *   font-              display sans body mono
 *   tracking-          tightest tighter tight normal wide wider widest
 *   leading-           display body butler
 *   duration-          instant quick considered slow cinematic
 *   ease-              standard-out standard-in cinematic
 *
 * Spacing is intentionally NOT extended — Layer 4's scale equals Tailwind's
 * default 4px-base scale (see tokens.ts spacing note).
 */
export const vesperPreset: Config = {
  content: [],
  theme: {
    extend: {
      colors: { ...colors },
      borderRadius: { ...borderRadius },
      fontFamily: typography.fontFamily as unknown as Record<string, string[]>,
      fontSize: typography.fontSize as unknown as Record<string, [string, { lineHeight: string }]>,
      letterSpacing: { ...typography.letterSpacing },
      lineHeight: { ...typography.lineHeight },
      transitionDuration: {
        instant: motion.duration.instant,
        quick: motion.duration.quick,
        considered: motion.duration.considered,
        slow: motion.duration.slow,
        cinematic: motion.duration.cinematic,
      },
      transitionTimingFunction: {
        'standard-out': motion.easing.standardOut,
        'standard-in': motion.easing.standardIn,
        cinematic: motion.easing.cinematic,
      },
    },
  },
  plugins: [],
};
