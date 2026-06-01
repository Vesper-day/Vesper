import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // In CI, webServer is omitted entirely — no server is started before tests run.
  // The CI workflow installs playwright browsers and runs with --pass-with-no-tests.
  // For local E2E: start `pnpm --filter @vesper/web dev` in a separate terminal first.
  ...(process.env.CI
    ? {}
    : {
        webServer: {
          command: 'pnpm --filter @vesper/web dev',
          url: 'http://localhost:3000',
          reuseExistingServer: true,
        },
      }),
});
