/**
 * Playwright E2E config for Cortex V3.
 * Runs against live Docker deployment (Cortex 3481, AO 3100, Web 9301).
 * @module e2e/playwright.config
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:9301',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
