import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
    // Web app code lives in app/ and lib/ (no src/ dir), so unit tests are
    // colocated there.
    include: ['{app,lib}/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['{app,lib}/**/*.{ts,tsx}'],
      exclude: ['{app,lib}/**/*.{test,spec}.{ts,tsx}'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
