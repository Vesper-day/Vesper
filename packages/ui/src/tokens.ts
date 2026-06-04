/**
 * Vesper design tokens — single source of truth.
 *
 * Values transcribed verbatim from docs/LAYER_4_EXPERIENCE_IDENTITY.md
 * (color, radius tables). Plain values only — this package is a leaf
 * (no @vesper/shared / @vesper/db imports). Consumed by the Tailwind
 * preset in ./tailwind.ts and resolved identically on web (Tailwind)
 * and mobile (NativeWind).
 */
export const colors = {
  // Backgrounds
  espresso: '#1E1815', // bg-primary — page/screen background
  surface: '#2B221C', // bg-surface — cards, blocks
  elevated: '#38291E', // bg-elevated — hover/active, modal sheets
  // Text
  cream: '#E8DDC9', // text-primary — body text
  'cream-muted': '#A89B85', // text-secondary — descriptions, labels
  'cream-faint': '#756B57', // text-tertiary — footnotes, ambient line
  // Accents
  bronze: '#B8884A', // accent-bronze — primary accent, buttons, links; also state-warning
  oxblood: '#5C2A2A', // accent-oxblood — destructive/error; also state-error
  // Borders
  'line-subtle': '#3D332A', // border-subtle — card outlines, dividers
  'line-strong': '#5C4F40', // border-strong — focus indicators, prominent containers
  // State
  success: '#6B7A5A', // state-success — muted forest green
} as const;

/**
 * Border radii — OVERRIDE Tailwind defaults, which do not match Layer 4.
 */
export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
} as const;

/**
 * Spacing: NO custom scale on purpose. Layer 4's space-1..space-32
 * (4,8,12,16,20,24,32,40,48,64,80,96,128px) already equals Tailwind's
 * default 4px-base scale (1=4px, 2=8px, … 32=128px). Leave spacing on the
 * Tailwind default — do not re-add a custom spacing object here.
 */

export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'monospace'],
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
  },
} as const;
