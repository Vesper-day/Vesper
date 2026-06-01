import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    include: ['src/**/*.{test,spec}.ts'],
    // RLS policy tests require a running local Supabase instance.
    // Set TEST_DB_URL to the local Supabase direct connection URL before running.
  },
});
