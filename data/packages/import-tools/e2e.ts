/**
 * End-to-end tests of an event's registration form, run by Playwright
 * against a real Camphoric with the event imported.
 *
 * In an event's repository:
 *
 *     // playwright.config.ts
 *     export default defineEventE2EConfig({ globalSetup: './e2e/global-setup.ts' });
 *
 *     // e2e/global-setup.ts
 *     import { validateEventImport } from '@camphoric/camphoric-event-import-spec';
 *     export default setUpEvent({ event, validate: validateEventImport });
 *
 *     // e2e/registration.spec.ts
 *     test('the form opens', async ({ registration }) => { await registration.open(); });
 *
 * The global setup starts a throwaway Camphoric from the release image
 * (CAMPHORIC_IMAGE_TAG picks its tag, CAMPHORIC_E2E_IMAGE a locally built
 * image; Docker needed), or uses CAMPHORIC_E2E_SERVER_URL's, imports the event
 * with its registration open, and removes the throwaway server when the tests
 * end. Every test, on every device, shares that one event: a registration
 * one test completes stays, taking up lodging capacity the others see.
 *
 * A throwaway server's PayPal is a fake (e2ePayPal.ts): with `onlinePayment`
 * the payment step shows PayPal's buttons, and a test can read what the
 * server asked PayPal for, without anything being paid.
 */

import { defineConfig, devices, test as base, type PlaywrightTestConfig } from '@playwright/test';

import { getAuthToken } from './getAuthInfo.ts';
import { CamphoricAdmin } from './e2eAdmin.ts';
import { importForE2E, type ImportForE2EOptions } from './e2eImport.ts';
import { FAKE_PAYPAL_SDK, FakePayPal, PAYPAL_SDK_URL } from './e2ePayPal.ts';
import { RegistrationForm } from './e2eRegistrationForm.ts';
import { camphoricServer, type CamphoricServerOptions } from './e2eServer.ts';

export { expect } from '@playwright/test';
export { camphoricServer } from './e2eServer.ts';
export type { CamphoricServer, CamphoricServerOptions } from './e2eServer.ts';
export { importForE2E } from './e2eImport.ts';
export type { ImportForE2EOptions } from './e2eImport.ts';
export { CamperSection, FormSection, ListQuestion, RegistrationForm } from './e2eRegistrationForm.ts';
export { CamphoricAdmin } from './e2eAdmin.ts';
export type { E2EInvitation, EmailsOptions, InviteOptions, SentEmail } from './e2eAdmin.ts';
export { FakePayPal } from './e2ePayPal.ts';
export type { PayPalOrder } from './e2ePayPal.ts';

// What the global setup hands the tests (workers inherit its environment)
const URL_VARIABLE = 'CAMPHORIC_E2E_RUN_URL';
const EVENT_VARIABLE = 'CAMPHORIC_E2E_RUN_EVENT_ID';
// The admin's API token (signing in once: Camphoric throttles sign-in)
const TOKEN_VARIABLE = 'CAMPHORIC_E2E_RUN_TOKEN';
// A throwaway server's fake PayPal API
const PAYPAL_VARIABLE = 'CAMPHORIC_E2E_RUN_PAYPAL_URL';

export type SetUpEventOptions = Pick<ImportForE2EOptions,
  'event' | 'validate' | 'withSampleRegistrations' | 'openRegistration' | 'onlinePayment'>
  & Omit<CamphoricServerOptions, 'fakePayPal'>;

/**
 * A Playwright global setup: starts the server, imports the event, and
 * returns the teardown that removes a throwaway server.
 */
export function setUpEvent(options: SetUpEventOptions): () => Promise<() => Promise<void>> {
  return async () => {
    const server = await camphoricServer({ ...options, fakePayPal: options.onlinePayment });
    try {
      if (options.onlinePayment && !server.payPalUrl) {
        throw new Error('onlinePayment needs the throwaway server, whose PayPal is a fake: '
          + 'CAMPHORIC_E2E_SERVER_URL\'s PayPal would refuse its client id');
      }
      const eventId = await importForE2E({ ...options, ...server });
      process.env[URL_VARIABLE] = server.url;
      process.env[EVENT_VARIABLE] = String(eventId);
      process.env[TOKEN_VARIABLE] = await getAuthToken(server.url);
      if (server.payPalUrl) process.env[PAYPAL_VARIABLE] = server.payPalUrl;
      else delete process.env[PAYPAL_VARIABLE];
    } catch (e) {
      await server.stop();
      throw e;
    }
    return server.stop;
  };
}

/**
 * A Playwright config for an event's e2e tests (in e2e/, on desktop and
 * mobile Chrome), around its global setup; `overrides` replace any of it.
 */
export function defineEventE2EConfig(
  { globalSetup, ...overrides }: { globalSetup: string } & PlaywrightTestConfig,
): PlaywrightTestConfig {
  return defineConfig({
    testDir: './e2e',
    globalSetup,
    // One server, one event: tests share them, so run them one at a time
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
    timeout: 60_000,
    expect: { timeout: 15_000 },
    use: { trace: 'on-first-retry' },
    projects: [
      { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
      { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    ],
    ...overrides,
  });
}

// The server's URL, from the global setup
function serverUrl(): string {
  const url = process.env[URL_VARIABLE];
  if (!url) throw new Error('no Camphoric server: run these tests with a config from defineEventE2EConfig');
  return url;
}

/**
 * Playwright's test, with the server as its baseURL and these fixtures:
 * `eventId`, the imported event's id; `registration`, its form; `admin`,
 * what an organizer does (invitations, the email sent); and `payPal`, the
 * throwaway server's fake PayPal (the orders the server created).
 */
// (Playwright reads a fixture's dependencies from its destructured first
// argument, so one with none takes an empty pattern.)
export const test = base.extend<{
  eventId: number,
  registration: RegistrationForm,
  admin: CamphoricAdmin,
  payPal: FakePayPal,
}>({
  // eslint-disable-next-line no-empty-pattern
  baseURL: async ({}, use) => {
    await use(serverUrl());
  },
  // With the fake PayPal API, the browser gets the fake PayPal script, whose
  // buttons work with it
  context: async ({ context }, use) => {
    if (process.env[PAYPAL_VARIABLE]) {
      await context.route(PAYPAL_SDK_URL, route => route.fulfill({
        contentType: 'text/javascript', body: FAKE_PAYPAL_SDK,
      }));
    }
    await use(context);
  },
  // eslint-disable-next-line no-empty-pattern
  eventId: async ({}, use) => {
    await use(Number(process.env[EVENT_VARIABLE]));
  },
  registration: async ({ page, eventId }, use) => {
    await use(new RegistrationForm(page, eventId));
  },
  admin: async ({ eventId }, use) => {
    const token = process.env[TOKEN_VARIABLE];
    if (!token) throw new Error('no admin token: run these tests with a config from defineEventE2EConfig');
    await use(new CamphoricAdmin(serverUrl(), token, eventId));
  },
  // eslint-disable-next-line no-empty-pattern
  payPal: async ({}, use) => {
    const url = process.env[PAYPAL_VARIABLE];
    if (!url) {
      throw new Error('no fake PayPal: it comes with the throwaway server (not CAMPHORIC_E2E_SERVER_URL) '
        + 'when setUpEvent is given onlinePayment: true');
    }
    await use(new FakePayPal(url));
  },
});
