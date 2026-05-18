import type { Config } from 'tailwindcss';
import { vesperPreset } from '@vesper/ui/tailwind';

const config: Config = {
  presets: [vesperPreset],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
