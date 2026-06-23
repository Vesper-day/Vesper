import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
    // Web app code lives in app/, lib/ and components/ (no src/ dir), so unit
    // tests are colocated there.
    include: ['{app,lib,components}/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['{app,lib,components}/**/*.{ts,tsx}'],
      exclude: ['{app,lib,components}/**/*.{test,spec}.{ts,tsx}'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
