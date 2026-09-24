/**
 * Component e2e (SPEC §12, DR-28) — drives the Ladle stories so the real form
 * engine, templating pipeline, data table, and admin widgets are exercised in a
 * browser, with no backend. Runs on desktop and mobile projects.
 */

import { expect, test } from '@playwright/test';

import { LADLE_URL } from '../playwright.config';

/** Open a Ladle story in preview mode (no Ladle chrome). */
const story = (id: string) => `${LADLE_URL}/?story=${id}&mode=preview`;

test.describe('Form engine', () => {
  test('renders the custom widgets through JsonSchemaForm', async ({ page }) => {
    await page.goto(story('json-schema-form--all-widgets'));
    await expect(page.locator('form').first()).toBeVisible();
    await expect(page.locator('form input, form select, form textarea').first()).toBeVisible();
  });
});

test.describe('Data table', () => {
  test('sorts, filters, and stays usable on small screens', async ({ page }) => {
    await page.goto(story('data-table--basic'));
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();

    // Sort by name ascending → an "Abby …" row sorts first.
    await page.getByRole('columnheader', { name: 'Name' }).click();
    await expect(rows.first()).toContainText('Abby');

    // Global fuzzy filter narrows to the matching rows.
    await page.getByPlaceholder(/search/i).fill('Xander');
    await expect(rows).toHaveCount(8);
    await expect(rows.first()).toContainText('Xander');
  });
});

test.describe('Templating', () => {
  test('renders handlebars helpers + markdown to sanitized HTML', async ({ page }) => {
    await page.goto(story('template--helpers'));
    const rendered = page.locator('.md-template').first();
    await expect(rendered).toBeVisible();
    await expect(rendered).not.toBeEmpty();
  });
});

test.describe('Admin attributes', () => {
  // AdminAttributesForm is a controlled input (the camper/registration editors
  // own the value and save it), so check it renders the combined schema with
  // the current value and reports each edit back to its parent.
  test('renders the combined admin schema and reports edits to its parent', async ({ page }) => {
    await page.goto(story('admin-attributes-form--populated'));
    const notes = page.getByLabel('VIP notes');
    await expect(notes).toHaveValue('Major sponsor');

    // The story shows the parent's copy of the value under "Current value".
    const current = page.locator('pre').last();
    await notes.fill('Board member');
    await expect(current).toContainText('"vip_notes": "Board member"');

    await page.getByLabel('Needs review').check();
    await expect(current).toContainText('"needs_review": true');
  });
});
