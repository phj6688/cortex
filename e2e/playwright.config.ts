/**
 * Playwright E2E config for Cortex V3.
 * @module e2e/playwright.config
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:9301',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm --filter server dev',
      port: 3481,
      reuseExistingServer: true,
      cwd: '..',
    },
    {
      command: 'pnpm --filter web dev',
      port: 9301,
      reuseExistingServer: true,
      cwd: '..',
    },
  ],
});
