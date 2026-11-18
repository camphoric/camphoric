/**
 * Playwright e2e configuration (SPEC §12, DR-28). Two suites:
 *   - component e2e drives the Storybook stories (no backend needed) — the form
 *     engine, templating, data table, and admin widgets;
 *   - a registration-flow smoke drives the dev server (needs the Django backend,
 *     VITE_API_PROXY's or :8000; tests skip gracefully when the config can't
 *     load). CI leaves it out, with its dev server: there's no backend there, and docker.yml's
 *     Sample Camp e2e drives the real registration form against a server.
 *
 * Every project runs on desktop and two mobile devices so layouts are exercised
 * responsively (DR-17). A test tagged @desktop-only runs on Desktop Chrome
 * alone: an admin screen's, whose unit test already checks the same thing, and
 * which depends on nothing about the screen or browser (DR-130).
 *
 * The static Storybook serves on 61000 and the dev server on 3003 (a CSRF-trusted
 * origin), or on CAMPHORIC_E2E_STORYBOOK_PORT and CAMPHORIC_E2E_APP_PORT, so runs
 * from two worktrees at once each serve their own code. A run starts its own
 * servers and waits for them to say they're listening, not for the port to
 * answer: a port that's taken, even by a run that took it during this one's
 * Storybook build, fails the run rather than letting it test whatever answers
 * there (another worktree's code). CAMPHORIC_E2E_REUSE_SERVERS=1 instead reuses
 * a server you started yourself. The registration smoke signs nobody in, so a
 * moved app port needs no CSRF-trusted origin.
 */

import { defineConfig, devices } from '@playwright/test';

/** A port from the environment, or the default when it's unset. */
function port(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`${name} must be a port number (1-65535), not '${value}'`);
  }
  return parsed;
}

const STORYBOOK_PORT = port('CAMPHORIC_E2E_STORYBOOK_PORT', 61000);
const APP_PORT = port('CAMPHORIC_E2E_APP_PORT', 3003);
export const STORYBOOK_URL = `http://localhost:${STORYBOOK_PORT}`;
export const APP_URL = `http://localhost:${APP_PORT}`;

const CI = !!process.env.CI;
const reuseExistingServer = !CI && process.env.CAMPHORIC_E2E_REUSE_SERVERS === '1';
// CI builds the Storybook in a step of its own (client.yml), so with CI set the
// server only serves storybook-static: build it first (npm run storybook:build)
// to run that way locally. Without CI, the server builds it each run.
// -u: unbuffered, so its "Serving HTTP on … port N" line arrives while it serves.
const serveStorybook = `python3 -u -m http.server ${STORYBOOK_PORT} --directory storybook-static`;

/**
 * A server of the run's own, ready when its output says so (`ready`). With
 * reuse, ready when its port answers instead, which an existing server can.
 */
function webServer(command: string, port: number, ready: RegExp, timeout: number) {
  return reuseExistingServer
    ? { command, url: `http://localhost:${port}`, reuseExistingServer, timeout }
    : { command, wait: { stdout: ready }, timeout };
}

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
    webServer(
      CI ? serveStorybook : `npm run storybook:build && ${serveStorybook}`,
      STORYBOOK_PORT,
      new RegExp(`^Serving HTTP on .* port ${STORYBOOK_PORT} `, 'm'),
      180_000,
    ),
    ...(CI
      ? []
      : [
          webServer(
            `npm run dev -- --port ${APP_PORT} --strictPort`,
            APP_PORT,
            new RegExp(`Local: +http://localhost:${APP_PORT}/`),
            120_000,
          ),
        ]),
  ],
});
