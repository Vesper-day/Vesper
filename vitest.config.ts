import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'apps/web/vitest.config.ts',
  'apps/mobile/vitest.config.ts',
  'packages/shared/vitest.config.ts',
  'packages/ai/vitest.config.ts',
  'packages/db/vitest.config.ts',
]);
