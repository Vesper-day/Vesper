import type { Config } from 'tailwindcss';
import { colors, borderRadius, typography } from './tokens';

/**
 * Shared Vesper Tailwind preset. Colors and radii are built from ./tokens.ts
 * (the single source of truth) — no hexes are duplicated here. Extended once
 * and consumed by apps/web (Tailwind) and apps/mobile (NativeWind) so the same
 * utility class names resolve identically across both.
 *
 * Utilities produced: bg-/text-/border- espresso, surface, elevated, cream,
 * cream-muted, cream-faint, bronze, oxblood, line-subtle, line-strong, success,
 * plus rounded-sm/md/lg/xl/2xl/full at the Layer 4 values.
 */
export const vesperPreset: Config = {
  content: [],
  theme: {
    extend: {
      colors: { ...colors },
      borderRadius: { ...borderRadius },
      fontFamily: typography.fontFamily as unknown as Record<string, string[]>,
      fontSize: typography.fontSize as unknown as Record<string, [string, { lineHeight: string }]>,
    },
  },
  plugins: [],
};
