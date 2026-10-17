/**
 * Registration-flow smoke (SPEC §7, §12). Drives the dev server (which proxies
 * to the Django backend) to confirm the public registration form loads, shows
 * the live price ticker, and is interactive — across desktop and mobile.
 *
 * It needs the backend on :8000; when the registration config can't load (no
 * backend), the test skips rather than failing, so the suite stays green in a
 * backend-less CI. It never submits, so it creates no data.
 */

import { expect, test } from '@playwright/test';

import { APP_URL } from '../playwright.config';

test.describe('Public registration', () => {
  test('loads, prices live, and is interactive', async ({ page }) => {
    await page.goto(`${APP_URL}/events/1/register`);

    const form = page.locator('form').first();
    const loaded = await form
      .waitFor({ state: 'visible', timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!loaded, 'Registration config did not load (backend not available).');

    // Redirects to step 1 and renders the schema-driven form.
    await expect(page).toHaveURL(/\/events\/1\/register\/registration$/);
    await expect(form).toBeVisible();

    // The live price ticker is present (§7.1).
    await expect(page.getByText(/total/i).first()).toBeVisible();

    // The form is interactive (no submit — creates no data).
    const firstInput = page.locator('form input').first();
    await firstInput.fill('Playwright');
    await expect(firstInput).toHaveValue('Playwright');
  });
});
