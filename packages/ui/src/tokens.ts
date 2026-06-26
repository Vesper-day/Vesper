/**
 * Vesper design tokens — single source of truth.
 *
 * Values transcribed verbatim from docs/LAYER_4_EXPERIENCE_IDENTITY.md
 * (the locked Layer 4 visual system: palette, type, spacing, radii, motion).
 * Plain values only — this package is a leaf (no @vesper/shared / @vesper/db
 * imports). Consumed by the Tailwind preset in ./tailwind.ts and resolved
 * identically on web (Tailwind) and mobile (NativeWind); the same object is
 * also read directly by React Native StyleSheet consumers and mirrored by
 * apps/mobile/ios/Shared/DesignTokens.swift for the native Swift surfaces.
 *
 * Later screens MUST compose from these tokens (and the primitives that read
 * them) — they never re-derive a hex, size, radius, or duration.
 */

/**
 * PALETTE — semantic Layer 4 colors. The keys are Vesper's material vocabulary
 * (espresso / surface / cream / bronze …); the trailing comment names the
 * Layer 4 semantic role each one fills. These keys are consumed live across
 * apps/web and apps/mobile (bg-/text-/border- utilities) and mirrored as
 * literal hexes in apps/web/app/(app)/calendar/_components/rbc-theme.css.
 */
export const colors = {
  // Backgrounds
  espresso: '#1E1815', // bg-primary — page/screen background, deepest layer
  surface: '#2B221C', // bg-surface — cards, blocks, elevated surfaces
  elevated: '#38291E', // bg-elevated — hover/active on surfaces, modal sheets
  // Text
  cream: '#E8DDC9', // text-primary — body text, primary content
  'cream-muted': '#A89B85', // text-secondary — secondary copy, descriptions, labels
  'cream-faint': '#756B57', // text-tertiary — footnote, ambient butler line, lowest hierarchy
  // Accents
  bronze: '#B8884A', // accent-bronze — primary accent: buttons, links, completion
  oxblood: '#5C2A2A', // accent-oxblood — secondary accent: destructive, error states
  // Borders
  'line-subtle': '#3D332A', // border-subtle — card outlines, dividers
  'line-strong': '#5C4F40', // border-strong — focus indicators, prominent containers
  // State
  success: '#6B7A5A', // state-success — muted forest green, success confirmations
  warning: '#B8884A', // state-warning — bronze, repurposed for warnings (= accent-bronze)
  error: '#5C2A2A', // state-error — oxblood, error/destructive confirmations (= accent-oxblood)
} as const;

/**
 * BORDER RADII — OVERRIDE Tailwind defaults, which do not match Layer 4.
 * No interactive element uses hard 90° corners (minimum radius-sm).
 */
export const borderRadius = {
  none: '0px', // full-bleed sections, hero panels
  sm: '4px', // chips, badges, small tags
  md: '8px', // buttons, input fields, secondary cards
  lg: '12px', // plan blocks, primary cards
  xl: '16px', // modal sheets, large containers
  '2xl': '24px', // sheet headers, prominent containers
  full: '9999px', // avatars, pill buttons, FAB
} as const;

/**
 * SPACING SCALE — 4px base unit (Layer 4 space-0 … space-32). Recorded here as
 * the single source for React Native / Swift consumers and for documentation.
 *
 * NOTE: the Tailwind preset deliberately does NOT re-declare spacing — Layer 4's
 * scale already equals Tailwind's default 4px-base scale (1=4px … 32=128px), so
 * web/mobile utilities stay on the Tailwind default rather than a parallel copy.
 */
export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
  32: '128px',
} as const;

/**
 * TYPOGRAPHY — three families (all Google Fonts) and the Layer 4 type roles.
 *
 * - Display family = Fraunces (variable serif; soft + optical-size axes):
 *   headlines, hero copy, ambient butler line, wordmark.
 * - Body family = Inter: body text, UI labels, form fields, general UI.
 * - Mono family = JetBrains Mono: times, timestamps, version strings (~5-8%).
 *
 * `fontFamily` / `fontSize` feed the Tailwind preset (utility classes).
 * `roles` carries the full per-role Layer 4 spec (family, point size range,
 * weight, Fraunces optical axis, letter-spacing, line-height) for RN/Swift
 * consumers and primitives that need an exact role rather than a utility.
 */
export const typography = {
  fontFamily: {
    display: ['Fraunces', 'Georgia', 'serif'],
    sans: ['Inter', 'system-ui', 'sans-serif'],
    body: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
  },
  // Utility fontSize scale (web/mobile). Kept stable for existing surfaces.
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
  },
  // Letter-spacing tokens (Layer 4 per-role tracking).
  letterSpacing: {
    tightest: '-0.02em', // Display 1
    tighter: '-0.015em', // Display 2
    tight: '-0.01em', // Display 3
    normal: '0', // body, butler line, body large
    wide: '0.005em', // body small
    wider: '0.02em', // UI label
    widest: '0.04em', // UI label small
  },
  // Line-height tokens (overridable per surface).
  lineHeight: {
    display: '1.2',
    body: '1.5',
    butler: '1.4',
  },
  fontWeight: {
    regular: '400',
    medium: '500',
  },
  /**
   * Per-role spec. `sizePt` is the Layer 4 point-size band ([min, max]) — these
   * roles are fluid by design; primitives/specs pick within the band. `optical`
   * is the Fraunces opsz axis value (display family only). `italic` flags the
   * butler line. Values verbatim from Layer 4.
   */
  roles: {
    display1: { family: 'display', sizePt: [48, 64], weight: 500, optical: 24, letterSpacing: '-0.02em', lineHeight: '1.2' },
    display2: { family: 'display', sizePt: [32, 40], weight: 500, optical: 18, letterSpacing: '-0.015em', lineHeight: '1.2' },
    display3: { family: 'display', sizePt: [24, 28], weight: 500, optical: 14, letterSpacing: '-0.01em', lineHeight: '1.2' },
    butlerLine: { family: 'display', sizePt: [14, 16], weight: 400, optical: 9, letterSpacing: '0', lineHeight: '1.4', italic: true },
    bodyLarge: { family: 'body', sizePt: [16, 18], weight: 400, letterSpacing: '0', lineHeight: '1.5' },
    body: { family: 'body', sizePt: [14, 15], weight: 400, letterSpacing: '0', lineHeight: '1.5' },
    bodySmall: { family: 'body', sizePt: [12, 13], weight: 400, letterSpacing: '0.005em', lineHeight: '1.5' },
    uiLabel: { family: 'body', sizePt: [12, 12], weight: 500, letterSpacing: '0.02em', lineHeight: '1.5' },
    uiLabelSmall: { family: 'body', sizePt: [10, 10], weight: 500, letterSpacing: '0.04em', lineHeight: '1.5' },
    mono: { family: 'mono', sizePt: [14, 14], weight: 400, letterSpacing: '0', lineHeight: '1.5' },
    monoSmall: { family: 'mono', sizePt: [12, 12], weight: 400, letterSpacing: '0', lineHeight: '1.5' },
  },
} as const;

/**
 * MOTION — Layer 4 duration bands, easing curves, the Reanimated spring, and the
 * reduced-motion fallback.
 *
 * `duration.bands` records each band's verbatim [min, max] ms range. `duration`
 * (top level) exposes one representative value per band — the band midpoint —
 * for Tailwind's `transitionDuration` utilities and single-value consumers; the
 * authoritative range is always `duration.bands`. `instant` (0ms) is the
 * reduced-motion fallback path, not a separate band.
 */
export const motion = {
  duration: {
    instant: '0ms', // reduced-motion fallback (prefers-reduced-motion / isReduceMotionEnabled)
    quick: '200ms', // band midpoint of 150-250ms
    considered: '400ms', // band midpoint of 300-500ms
    slow: '750ms', // band midpoint of 600-900ms
    cinematic: '1500ms', // band midpoint of 1000-2000ms
    bands: {
      quick: [150, 250], // taps, button presses, toggles, input focus, micro-interactions
      considered: [300, 500], // page transitions, sheet slide-up, plan reveals, block expansions
      slow: [600, 900], // ambient transitions (butler line rotation, time-of-day shifts)
      cinematic: [1000, 2000], // hero reveals, onboarding, splash, first-plan reveal
    },
  },
  easing: {
    standardOut: 'cubic-bezier(0.2, 0.8, 0.2, 1.0)', // entry animations
    standardIn: 'cubic-bezier(0.4, 0.0, 1.0, 1.0)', // exit animations
    cinematic: 'cubic-bezier(0.4, 0.0, 0.1, 1.0)', // storytelling moments
  },
  // React Native Reanimated spring — interactive feedback.
  spring: { damping: 18, stiffness: 150 },
  // All animation swaps for INSTANT transitions when reduced motion is on.
  reducedMotionFallback: 'instant',
} as const;
