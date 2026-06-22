import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    include: ['{src,lib,store,app,hooks}/**/*.{test,spec}.{ts,tsx}'],
    // Mobile reads these at module load (lib/supabase.ts). Provide offline stubs
    // so importing the auth modules under test never touches a real backend.
    env: {
      EXPO_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});
