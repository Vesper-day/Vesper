import { defineConfig } from 'vitest/config';
import { createRequire } from 'node:module';

// libsodium-wrappers ships a BROKEN ESM build: dist/modules-esm/libsodium-wrappers.mjs
// imports a nonexistent ./libsodium.mjs, so Vite's default `import` condition fails
// with "Cannot find module .../libsodium.mjs". The CJS build (`require`/`main`) works.
// Alias the bare specifier to its resolved CJS entry so vitest loads the good build.
// The web app gets the equivalent via `serverExternalPackages` in apps/web/next.config.ts.
const require = createRequire(import.meta.url);
const libsodiumWrappersCjs = require.resolve('libsodium-wrappers');

export default defineConfig({
  resolve: {
    alias: { 'libsodium-wrappers': libsodiumWrappersCjs },
  },
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    include: ['src/**/*.{test,spec}.ts'],
    // RLS policy tests require a running local Supabase instance.
    // Set TEST_DB_URL to the local Supabase direct connection URL before running.
  },
});
