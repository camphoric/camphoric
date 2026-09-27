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

test.describe('Recipient filter builder', () => {
  // The story prints the filter JSON the builder produces under it.
  test('builds conditions with operators and values by field type', async ({ page }) => {
    await page.goto(story('recipient-filter-builder--empty'));
    const json = page.getByTestId('filter-json');
    await expect(page.getByText('No conditions: every camper is included.')).toBeVisible();

    await page.getByRole('button', { name: 'Add condition' }).click();
    const row = page.getByRole('group', { name: 'Condition 1' });
    await row.getByRole('textbox', { name: 'Field' }).click();
    await page.getByRole('option', { name: 'Balance' }).click();
    await row.getByRole('textbox', { name: 'Operator' }).click();
    await page.getByRole('option', { name: '>', exact: true }).click();
    await row.getByRole('textbox', { name: 'Value' }).fill('25');
    await expect(json).toContainText('"op": "gt"');
    await expect(json).toContainText('"value": 25');

    await page.getByRole('button', { name: 'Add condition' }).click();
    const second = page.getByRole('group', { name: 'Condition 2' });
    await second.getByRole('textbox', { name: 'Field' }).click();
    await page.getByRole('option', { name: 'Meals' }).click();
    await second.getByRole('textbox', { name: 'Operator' }).click();
    await page.getByRole('option', { name: 'is any of' }).click();
    await second.getByRole('textbox', { name: 'Value' }).click();
    await page.getByRole('option', { name: 'Vegan' }).click();
    await expect(json).toContainText('"Vegan"');

    await page.getByRole('radiogroup', { name: 'Match' }).getByText('any').click();
    await expect(json).toContainText('"combinator": "or"');
    await page.getByRole('button', { name: 'Remove condition 1' }).click();
    await expect(json).not.toContainText('registration.balance');
  });
});

test.describe('Send a group email', () => {
  // The story answers the API itself and prints what it posted.
  test('replaces the recipients with a filter, then confirms the send', async ({ page }) => {
    await page.goto(story('send-dialog--send'));
    await expect(page.getByText('Recipients: 6 of 6 selected')).toBeVisible();

    await page.getByRole('button', { name: 'Choose more recipients' }).click();
    await page.getByRole('button', { name: 'Add condition' }).click();
    const row = page.getByRole('group', { name: 'Condition 1' });
    await row.getByRole('textbox', { name: 'Field' }).click();
    await page.getByRole('option', { name: 'Balance' }).click();
    await row.getByRole('textbox', { name: 'Operator' }).click();
    await page.getByRole('option', { name: '>', exact: true }).click();
    await row.getByRole('textbox', { name: 'Value' }).fill('10');
    await page.getByRole('button', { name: 'Replace the list with 2' }).click();
    await expect(page.getByText('Recipients: 2 of 2 selected')).toBeVisible();

    await page.getByRole('button', { name: 'Send to 2 recipients' }).click();
    const confirm = page.getByRole('dialog', { name: 'Send this email?' });
    await expect(confirm).toContainText('goes to 2 recipients');
    await confirm.getByRole('button', { name: 'Send', exact: true }).click();
    const posted = page.getByTestId('posted');
    await expect(posted).toContainText('/send/');
    await expect(posted).toContainText('"camper:3"');
    await expect(posted).toContainText('"camper:11"');
    await expect(posted).not.toContainText('"camper:4"');
  });
});

test.describe('Form lists', () => {
  // The story prints the form data under the form.
  test('boxes each item with its own remove button and a labelled add button', async ({ page }) => {
    await page.goto(story('json-schema-form--lists'));
    const data = page.getByTestId('list-data');
    await expect(page.getByRole('heading', { name: 'Parking Passes' })).toBeVisible();
    await expect(page.locator('fieldset')).toHaveCount(0);
    // Outside registration, the registration-only field shows.
    await expect(page.getByText('Parking Type')).toBeVisible();

    await page.getByRole('button', { name: 'Add A Parking Pass' }).click();
    await expect(page.locator('.rjsf-field-array').first().getByTitle('Remove')).toHaveCount(2);
    await page.locator('.rjsf-field-array').first().getByTitle('Remove').first().click();
    await expect(page.locator('.rjsf-field-array').first().getByTitle('Remove')).toHaveCount(1);
    await expect(data).toContainText('"parking_passes"');
    // Only the list that opts in can be reordered.
    await expect(page.getByTitle('Move down').first()).toBeVisible();
  });

  test('hides registration-only fields during registration', async ({ page }) => {
    await page.goto(story('json-schema-form--lists-during-registration'));
    await expect(page.getByText('Vehicle Type')).toBeVisible();
    await expect(page.getByText('Parking Type')).toBeHidden();
  });
});

test.describe('Read-only for Reporters', () => {
  // The story wraps the send dialog in a Reporter's permissions.
  test('a Reporter can review recipients but not send', async ({ page }) => {
    await page.goto(story('send-dialog--as-reporter'));
    await expect(page.getByText(/Recipients: \d+ of \d+ selected/)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Send to/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Send a test to me' })).toHaveCount(0);
  });
});

test.describe('User administration', () => {
  test('a new user is a regular user, and you can’t change your own group', async ({ page }) => {
    await page.goto(story('user-form--new-user-as-superuser'));
    await expect(page.getByRole('textbox', { name: 'Django access' })).toHaveValue('Regular user');
    await page.getByRole('textbox', { name: 'Username' }).fill('lee');
    await page.getByRole('textbox', { name: 'Email' }).fill('lee@example.com');
    await page.getByRole('button', { name: 'Add user' }).click();
    await expect(page.getByTestId('saved')).toContainText('"django_access": "regular"');

    await page.goto(story('user-form--edit-yourself'));
    await expect(page.getByRole('textbox', { name: 'Camphoric permission group' })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: 'Django access' })).toBeDisabled();
  });

  test('an Admin adds and renames an organization', async ({ page }) => {
    await page.goto(story('organization-chooser--as-admin'));
    await page.getByRole('button', { name: 'New organization' }).click();
    await page.getByRole('dialog').getByRole('textbox', { name: 'Name' }).fill('Folk Week');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Folk Week')).toBeVisible();

    await page.getByRole('button', { name: 'Change Folk Week' }).click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    const name = page.getByRole('dialog').getByRole('textbox', { name: 'Name' });
    await name.fill('Folk Camp');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Folk Camp')).toBeVisible();
  });
});

test.describe('Passwords', () => {
  test('choosing a password checks the two match', async ({ page }) => {
    await page.goto(story('password-forms--set-password'));
    await page.getByLabel('New password', { exact: true }).fill('Correct-horse-9');
    await page.getByLabel('New password again').fill('Correct-horse-8');
    await expect(page.getByText('The passwords don’t match.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Set password' })).toBeDisabled();
    await page.getByLabel('New password again').fill('Correct-horse-9');
    await page.getByRole('button', { name: 'Set password' }).click();
    await expect(page.getByTestId('chosen')).toHaveText('15 characters');
  });

  test('forgot password gives the same answer for any address', async ({ page }) => {
    await page.goto(story('login--sign-in'));
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await page.getByRole('textbox', { name: 'Email' }).fill('anyone@example.com');
    await page.getByRole('button', { name: 'Email me a link' }).click();
    await expect(page.getByText(/If an account uses that address/)).toBeVisible();
  });
});

test.describe('Deletes and history', () => {
  test('a delete that something blocks says why, with no Delete', async ({ page }) => {
    await page.goto(story('confirm-delete--blocked'));
    await expect(page.getByText('Campers still have this charge.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  test('a delete says what it takes with it and who it unassigns', async ({ page }) => {
    await page.goto(story('confirm-delete--unassigns-campers'));
    await expect(page.getByText('2 lodgings: Cabin A, Cabin B')).toBeVisible();
    await expect(page.getByText('23 campers will be unassigned from their lodging')).toBeVisible();
    await expect(page.getByText(/and 3 more$/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  test('a history shows who changed what', async ({ page }) => {
    await page.goto(story('history-list--registration'));
    await expect(page.getByText('Main address › City')).toBeVisible();
    await expect(page.getByText('Berkeley → Oakland')).toBeVisible();
    await expect(page.getByText('No one signed in')).toBeVisible();
  });
});

test.describe('Pricing overrides', () => {
  test('a Registrar sees what an overridden line works out to, and can change it', async ({
    page,
  }) => {
    await page.goto(story('fee-breakdown--overridden-as-registrar'));
    await expect(page.getByText(/the pricing works out \$920\.00/)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Change the override of Tuition' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Override Meals' })).toBeVisible();
    await expect(page.getByText(/Not in effect/)).toBeVisible();
  });

  test('a Reporter sees the override but can’t change it', async ({ page }) => {
    await page.goto(story('fee-breakdown--overridden-as-reporter'));
    await expect(page.getByText(/the pricing works out \$920\.00/)).toBeVisible();
    await expect(page.getByRole('button')).toHaveCount(0);
  });
});
