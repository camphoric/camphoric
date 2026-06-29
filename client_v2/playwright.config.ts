/**
 * Playwright e2e configuration (SPEC §12, DR-28). Two suites:
 *   - component e2e drives the Ladle stories (no backend needed) — the form
 *     engine, templating, data table, and admin widgets;
 *   - a registration-flow smoke drives the dev server (needs the Django backend
 *     on :8000; tests skip gracefully when the config can't load).
 *
 * Every project runs on desktop and two mobile devices so layouts are exercised
 * responsively (DR-17). Ladle serves on 61000; the dev server on 3003 (a
 * CSRF-trusted origin).
 */

import { defineConfig, devices } from '@playwright/test';

export const LADLE_URL = 'http://localhost:61000';
export const APP_URL = 'http://localhost:3003';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  // Ladle compiles each story on first visit (Vite dev), so give assertions and
  // actions generous timeouts to absorb a cold start.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    trace: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: [
    // Serve a static Ladle build (not the dev server) so story loads are
    // deterministic — no on-demand Vite compile/reload mid-test.
    {
      command: 'npm run ladle:build && python3 -m http.server 61000 --directory ladle-dist',
      url: LADLE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: 'npm run dev -- --port 3003 --strictPort',
      url: APP_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
