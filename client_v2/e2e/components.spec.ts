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

test.describe('Template editor', () => {
  // The story uses a real variable spec and a stand-in preview that flags
  // `frist_name` as a typo and an unclosed {% for %} as a syntax error.
  test('suggests fields from the variable spec and marks problems', async ({ page }) => {
    await page.goto(story('template-editor--with-problems'));
    const editor = page.locator('.monaco-editor').first();
    await expect(editor).toBeVisible();

    // The preview's problems are listed and underlined in the text.
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Unexpected end of template' }),
    ).toBeVisible();
    await expect(editor.locator('.squiggly-warning')).toHaveCount(1);
    await expect(editor.locator('.squiggly-error')).toHaveCount(1);

    // Clicking below the text puts the cursor at the end of the template.
    const box = await editor.boundingBox();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height - 20);
    await page.keyboard.type('{{ camper.attributes.');
    const suggestions = editor.locator('.suggest-widget');
    await expect(suggestions).toContainText('first_name');
    await expect(suggestions).toContainText('linens');
  });
});

test.describe('Template help', () => {
  test('searches the variables and inserts one', async ({ page }) => {
    await page.goto(story('template-help-panel--with-insert'));
    await page.getByLabel('Search help').fill('nights');
    await expect(page.getByRole('heading', { name: 'attributes:camper' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Insert nights' }).click();
    await expect(page.getByText('Inserted:')).toContainText('.nights');

    await page.getByRole('tab', { name: 'Guides' }).click();
    await expect(page.getByRole('heading', { name: 'Jinja basics' })).toBeVisible();
  });
});

test.describe('Email template editor', () => {
  // The story answers the preview itself, filling each {{ … }} with the sample's name.
  test('previews the subject and body for the chosen sample', async ({ page }) => {
    await page.goto(story('email-template-editor--jinja'));
    const preview = page.getByRole('region', { name: 'Template preview' });
    await expect(preview).toContainText('Your invitation to Lee');

    await page.getByRole('textbox', { name: 'Preview for' }).click();
    await page.getByRole('option', { name: 'Sam <sam@example.com>' }).click();
    await expect(preview).toContainText('Your invitation to Sam');
  });
});

test.describe('Email history', () => {
  // The story filters its sample messages the way the server does.
  test('filters by status and searches, on any screen size', async ({ page }) => {
    await page.goto(story('email-history-table--history'));
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(6);

    const status = page.getByRole('radiogroup', { name: 'Status' });
    await status.getByText('Failed', { exact: true }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('typo@exmaple.com');

    await status.getByText('All', { exact: true }).click();
    await page.getByPlaceholder('Search recipient or subject…').fill('lee@');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Retrying (2 tried)');
  });
});
