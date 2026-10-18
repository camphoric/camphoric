/**
 * Playwright e2e configuration (SPEC §12, DR-28). Two suites:
 *   - component e2e drives the Storybook stories (no backend needed) — the form
 *     engine, templating, data table, and admin widgets;
 *   - a registration-flow smoke drives the dev server (needs the Django backend
 *     on :8000; tests skip gracefully when the config can't load). CI leaves it
 *     out, with its dev server: there's no backend there, and docker.yml's
 *     Sample Camp e2e drives the real registration form against a server.
 *
 * Every project runs on desktop and two mobile devices so layouts are exercised
 * responsively (DR-17). A test tagged @desktop-only runs on Desktop Chrome
 * alone: an admin screen's, whose unit test already checks the same thing, and
 * which depends on nothing about the screen or browser (DR-130). The static Storybook serves on 61000;
 * the dev server on 3003 (a CSRF-trusted origin).
 */

import { defineConfig, devices } from '@playwright/test';

export const STORYBOOK_URL = 'http://localhost:61000';
export const APP_URL = 'http://localhost:3003';

const CI = !!process.env.CI;
// CI builds the Storybook in a step of its own (client.yml), so with CI set the
// server only serves storybook-static: build it first (npm run storybook:build)
// to run that way locally. Without CI, the server builds it each run.
const serveStorybook = 'python3 -m http.server 61000 --directory storybook-static';
const mobile = { grepInvert: /@desktop-only/ };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  testIgnore: CI ? ['**/registration.spec.ts'] : [],
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  reporter: CI ? 'github' : 'list',
  // A worker per CPU of the runner (Playwright's default is half).
  workers: CI ? 4 : undefined,
  // A story loads its code on first visit (Monaco's is large), so give
  // assertions and actions generous timeouts to absorb a cold start.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    trace: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] }, ...mobile },
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'] }, ...mobile },
  ],
  webServer: [
    // Serve a static Storybook build (not the dev server) so story loads are
    // deterministic — no on-demand Vite compile/reload mid-test.
    {
      command: CI ? serveStorybook : `npm run storybook:build && ${serveStorybook}`,
      url: STORYBOOK_URL,
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
    ...(CI
      ? []
      : [
          {
            command: 'npm run dev -- --port 3003 --strictPort',
            url: APP_URL,
            reuseExistingServer: true,
            timeout: 120_000,
          },
        ]),
  ],
});
