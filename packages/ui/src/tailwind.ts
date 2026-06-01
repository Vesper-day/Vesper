import type { Config } from 'tailwindcss';
import { colors, typography } from './tokens';

export const vesperPreset: Config = {
  content: [],
  theme: {
    extend: {
      colors: {
        vesper: colors.vesper,
        surface: colors.surface,
      },
      fontFamily: typography.fontFamily as unknown as Record<string, string[]>,
      fontSize: typography.fontSize as unknown as Record<string, [string, { lineHeight: string }]>,
    },
  },
  plugins: [],
};