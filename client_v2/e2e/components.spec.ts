/**
 * Component e2e (SPEC §12, DR-28) — drives the Storybook stories so the real form
 * engine, templating pipeline, data table, and admin widgets are exercised in a
 * browser, with no backend. Runs on desktop and mobile projects.
 */

import { expect, type Page, test } from '@playwright/test';

import { STORYBOOK_URL } from '../playwright.config';

/** Open a story on its own (Storybook's iframe, without the Storybook UI). */
const story = (id: string) => `${STORYBOOK_URL}/iframe.html?id=${id}&viewMode=story`;

/** The story's table rows (Storybook's page also holds a hidden placeholder table). */
const tableRows = (page: Page) => page.locator('#storybook-root tbody tr');

test.describe('Form engine', () => {
  test('renders the custom widgets through JsonSchemaForm', async ({ page }) => {
    await page.goto(story('json-schema-form--all-widgets'));
    await expect(page.locator('form').first()).toBeVisible();
    await expect(page.locator('form input, form select, form textarea').first()).toBeVisible();
  });

  test('checkboxes save the choices in the order they are listed', async ({ page }) => {
    await page.goto(story('checkboxes--days'));
    await page.getByLabel('Fri Jan 1').check();
    await page.getByLabel('Sun Jan 3').check();
    await page.getByLabel('Sat Jan 2').check();

    const saved: unknown = JSON.parse((await page.getByTestId('form-data').textContent()) ?? '{}');
    expect(saved).toEqual({ attendance: ['Fri Jan 1', 'Sat Jan 2', 'Sun Jan 3'] });
  });

  test('phone keeps the country when filled all at once, as autofill does', async ({ page }) => {
    await page.goto(story('phone-input--empty'));
    const phone = page.getByLabel('Phone');
    const saved = async () =>
      JSON.parse((await page.getByTestId('form-data').textContent()) ?? '{}') as unknown;

    // fill() sets the whole value at once, replacing the +1 the field starts with.
    await phone.fill('(202) 555-1234');
    await expect.poll(saved).toEqual({ phone: '+12025551234' });

    await phone.fill('+44 20 7946 0958');
    await expect.poll(saved).toEqual({ phone: '+442079460958' });
  });
});

test.describe('Data table', () => {
  test('sorts, filters, and stays usable on small screens', async ({ page }) => {
    await page.goto(story('data-table--basic'));
    const rows = tableRows(page);
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

test.describe('Code editor', () => {
  // Monaco is bundled (DR-58): the JSON worker must load from the build for
  // the missing comma to be underlined.
  test('checks JSON in its worker', async ({ page }) => {
    await page.goto(story('json-editor--invalid-json'));
    const editor = page.locator('.monaco-editor').first();
    await expect(editor).toBeVisible();
    await expect(editor.locator('.squiggly-error').first()).toBeVisible();
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

  test('hides the preview and edits in an expanded view', async ({ page }) => {
    await page.goto(story('template-editor--with-problems'));
    const preview = page.getByRole('region', { name: 'Template preview' });
    await expect(preview).toBeVisible();

    // Hidden, the preview's problems are still counted (and underlined).
    await page.getByRole('button', { name: 'Hide preview' }).click();
    await expect(preview).toHaveCount(0);
    await page.getByRole('button', { name: 'Show preview (2 problems)' }).click();
    await expect(preview).toBeVisible();

    // What's typed in the expanded view is there when it closes.
    await page.getByRole('button', { name: 'Expand' }).click();
    const dialog = page.getByRole('dialog', { name: 'Template' });
    const expanded = dialog.locator('.monaco-editor');
    await expect(expanded).toBeVisible();
    await expect(dialog.getByRole('region', { name: 'Template preview' })).toBeVisible();
    const box = await expanded.boundingBox();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height - 20);
    await page.keyboard.type('Total');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.monaco-editor .view-lines')).toContainText('Total');
  });
});

test.describe('Template help', () => {
  test('searches the variables and inserts one', async ({ page }) => {
    await page.goto(story('template-help-panel--with-insert'));
    await page.getByLabel('Search help').fill('nights');
    await expect(page.getByRole('heading', { name: 'attributes:camper' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Insert nights' }).click();
    await expect(page.getByText('Inserted:')).toContainText('.nights');

    await page.getByRole('tab', { name: 'Markdown' }).click();
    await page.getByLabel('Search help').fill('table');
    await expect(page.getByRole('table')).toBeVisible();

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
    const rows = tableRows(page);
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
    await expect(page.getByText('Anonymous User')).toBeVisible();
  });

  test('a user’s history names each change in full, with older ones to load', async ({ page }) => {
    await page.goto(story('user-history-panel--with-more'));
    await expect(page.getByRole('heading', { name: 'Changes by Reggie Registrar' })).toBeVisible();
    await expect(page.getByText(/^Registration #5 \(Lark Camp\): /).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show older changes' })).toBeVisible();
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

test.describe('Lodging marked full or open', () => {
  test('marked full can’t be chosen, whatever its room', async ({ page }) => {
    await page.goto(story('fields--lodging-requested-marked'));
    await page.getByPlaceholder('Area *').click();
    await expect(page.getByRole('option', { name: 'Tent Field (full)' })).toHaveAttribute(
      'data-combobox-disabled',
      'true',
    );
    await page.getByRole('option', { name: 'Cabins' }).click();
    await page.getByPlaceholder('Cabin *').click();
    // Cabin B has no room but is marked open.
    await expect(page.getByRole('option', { name: 'Cabin B', exact: true })).not.toHaveAttribute(
      'data-combobox-disabled',
      'true',
    );
  });
});

test.describe('Lodging timeline', () => {
  test('units are grouped under sections named for where they are', async ({ page }) => {
    await page.goto(story('lodging-timeline--assignment'));
    const headings = page.locator('#storybook-root [role="heading"][aria-level="3"]');
    await expect(headings).toHaveText(['Camp 1 → Cabins', 'Camp 1 → Tents', 'Top level']);
  });

  test('clicking a camper selects them instead of leaving the page', async ({ page }) => {
    await page.goto(story('lodging-timeline--assignment'));
    await page.getByRole('button', { name: 'Buffy Summers' }).click();
    await expect(page.getByTestId('selected-camper')).toHaveText('Selected: Buffy Summers');
    await page.getByRole('button', { name: 'Ani Skywalker' }).click();
    await expect(page.getByTestId('selected-camper')).toHaveText('Selected: Ani Skywalker');
  });

  test('the view narrows to any lodging, a top-level unit included', async ({ page }) => {
    await page.goto(story('lodging-timeline--assignment'));
    await page.getByRole('textbox', { name: 'Show lodging' }).fill('Off');
    await page.getByRole('option', { name: 'Off Site' }).click();
    await expect(page.getByRole('button', { name: 'Kaylee Frye' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bob Ross' })).toHaveCount(0);
  });
});

/** Open a lodging tree story with every node expanded (the tree starts collapsed). */
async function openExpandedTree(page: Page, id: string) {
  await page.goto(story(id));
  // Wait for the tree, or there's nothing to count yet.
  await expect(page.getByRole('button', { name: 'Expand Camp 1' })).toBeVisible();
  const expand = page.getByRole('button', { name: /^Expand / });
  while ((await expand.count()) > 0) await expand.first().click();
}

test.describe('Lodging hierarchy', () => {
  test('lists each node’s children by name', async ({ page }) => {
    await openExpandedTree(page, 'lodging-tree--hierarchy');
    const names = page.locator('#storybook-root').getByText(/^(Camp 1|Off Site|Cabin [AB])$/);
    await expect(names).toHaveText(['Camp 1', 'Cabin A', 'Cabin B', 'Off Site']);
  });

  test('a unit lists its campers on one line', async ({ page }) => {
    await openExpandedTree(page, 'lodging-tree--hierarchy');
    await expect(page.getByText('Bob Ross, Jane Ross', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unassign' })).toHaveCount(0);
  });

  test('starts collapsed; nodes with nodes under them, but the root, expand', async ({ page }) => {
    await page.goto(story('lodging-tree--hierarchy'));
    await expect(page.getByRole('button', { name: /^(Collapse|Expand) Lodging$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Off Site', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cabins', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Expand Camp 1' }).click();
    await expect(page.getByRole('button', { name: 'Cabin A', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Expand Cabins' }).click();
    await expect(page.getByText('Bob Ross, Jane Ross', { exact: true })).toBeVisible();
    // A unit has nothing under it to collapse but its campers.
    await expect(page.getByRole('button', { name: /^(Collapse|Expand) Cabin A$/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Collapse Cabins' }).click();
    await expect(page.getByRole('button', { name: 'Cabin A', exact: true })).toHaveCount(0);
  });

  test('a node’s name shows all its details, with Edit', async ({ page }) => {
    await openExpandedTree(page, 'lodging-tree--hierarchy');
    await page.getByRole('button', { name: 'Cabins', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Details for Cabins' });
    await expect(panel.getByText('3 of 4')).toBeVisible();
    await expect(panel.getByText('4 (the sum of the units under it)')).toBeVisible();
    await expect(panel.getByText('Choose one')).toBeVisible();
    await expect(panel.getByText(/remind campers to bring warm sleeping bags/)).toBeVisible();
    await panel.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByTestId('editing')).toHaveText('Editing: Cabins');
  });

  test('a Reporter sees a node’s details but can’t edit it', async ({ page }) => {
    await openExpandedTree(page, 'lodging-tree--as-reporter');
    await page.getByRole('button', { name: 'Cabin A', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Details for Cabin A' });
    await expect(panel.getByText('2 of 2')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  });
});

test.describe('Lodging notes', () => {
  test('the hierarchy opens a node’s notes from its icon', async ({ page }) => {
    await openExpandedTree(page, 'lodging-tree--hierarchy');
    await expect(page.getByRole('button', { name: 'Notes for Cabin B' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Notes for Cabin A' }).click();
    await expect(page.getByText(/The ladder to the top bunk is broken/)).toBeVisible();
  });

  test('selecting a unit on the timeline shows its details and notes', async ({ page }) => {
    await page.goto(story('lodging-timeline--assignment'));
    // Cabins, Cabin A and Tent 1 have notes.
    await expect(page.getByRole('img', { name: 'Has notes' })).toHaveCount(3);
    await page.getByRole('button', { name: 'Cabin A', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Details for Cabin A' });
    await expect(panel.getByText('2 of 2')).toBeVisible();
    await expect(panel.getByText(/The ladder to the top bunk is broken/)).toBeVisible();
  });

  test('selecting a section on the timeline shows its parent’s notes', async ({ page }) => {
    await page.goto(story('lodging-timeline--assignment'));
    await page.getByRole('button', { name: 'Camp 1 → Cabins' }).click();
    const panel = page.getByRole('region', { name: 'Details for Cabins' });
    await expect(panel.getByText(/remind campers to bring warm sleeping bags/)).toBeVisible();
  });
});

test.describe('Camper lodging tab', () => {
  test('shows where the camper is placed, the unit’s notes, and who else is there', async ({
    page,
  }) => {
    await page.goto(story('camper-lodging--placed'));
    await expect(page.getByText('Camp 1 → Cabins → Cabin A')).toBeVisible();
    await expect(page.getByText('3 days: Fri 10/16 – Sun 10/18')).toBeVisible();
    await expect(page.getByText(/The ladder to the top bunk is broken/)).toBeVisible();
    const others = page.getByRole('list', { name: 'Others in this unit' });
    await expect(others.getByRole('listitem')).toHaveText([
      /^Annie Ross1 day: Fri 10\/16$/,
      /^Jane Ross2 days: Sat 10\/17 – Sun 10\/18$/,
    ]);
    await others.getByRole('button', { name: 'Jane Ross' }).click();
    await expect(page.getByTestId('opened')).toHaveText('Opened: camper 2');
    await page.getByRole('button', { name: 'Open in Lodging' }).click();
    await expect(page.getByTestId('opened')).toHaveText('Opened: lodging');
  });

  test('says when no one else is in the unit', async ({ page }) => {
    await page.goto(story('camper-lodging--alone'));
    await expect(page.getByText('No one else')).toBeVisible();
  });

  test('a camper not yet placed reads as unassigned', async ({ page }) => {
    await page.goto(story('camper-lodging--unassigned'));
    await expect(page.getByText('Unassigned')).toBeVisible();
    await expect(page.getByText('Others in this unit')).toHaveCount(0);
  });
});

test.describe('Camper lodging info', () => {
  test('shows what an admin needs to place the camper', async ({ page }) => {
    await page.goto(story('camper-lodging-info--placed'));
    const panel = page.getByRole('region', { name: 'Lodging details for Bob Ross' });
    await expect(panel.getByText('Yes, with Jane Ross')).toBeVisible();
    await expect(panel.getByText('Bob needs a lower bunk.')).toBeVisible();
    await expect(panel.getByText('Would like to be near the bathhouse.')).toBeVisible();
    await expect(panel.getByText(/The top bunk is broken/)).toBeVisible();
    await expect(panel.getByText('3 days: Fri 10/16 – Sun 10/18')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Unassign' })).toBeVisible();
  });

  test('a Reporter can read it but not unassign', async ({ page }) => {
    await page.goto(story('camper-lodging-info--placed-as-reporter'));
    await expect(page.getByText('Yes, with Jane Ross')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unassign' })).toHaveCount(0);
  });
});

test.describe('Promo codes', () => {
  test('a registrant applies a code, and can’t continue with one left unapplied', async ({
    page,
  }) => {
    await page.goto(story('promo-code-entry--working'));
    const field = page.getByRole('textbox', { name: 'Promo code' });
    await field.fill('winter');
    await field.press('Enter');
    await expect(page.getByRole('alert')).toHaveText(/isn’t valid for this event/);

    await field.fill('spring');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText('Applied: Spring sale — $20 off')).toBeVisible();
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByText('Submitted.')).toBeVisible();

    await field.fill('springtime');
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByRole('alert')).toHaveText(/Apply this promo code, or clear it/);
    await expect(page.getByText('Submitted.')).toHaveCount(0);
  });

  test('the review names a per-camper discount on each camper it applies to', async ({ page }) => {
    await page.goto(story('registration-review--with-promo-code'));
    // The registration's discount and the second camper's; the first's is $0.
    await expect(page.getByText('Sibling discount')).toHaveCount(2);
    await expect(page.getByText('-$100.00')).toHaveCount(2);
  });

  test('an admin edits a code', async ({ page }) => {
    await page.goto(story('promo-code-form--per-camper-expiring'));
    await expect(page.getByRole('radio', { name: 'For each camper' })).toBeChecked();
    await page.getByRole('textbox', { name: 'Label' }).fill('Siblings');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('#storybook-root pre')).toContainText('"label": "Siblings"');
    await expect(page.locator('#storybook-root pre')).toContainText('"scope": "camper"');
    await expect(page.locator('#storybook-root pre')).toContainText(
      '"expiration_date": "2026-12-01T08:00:00.000Z"',
    );
  });
});

test.describe('Payments and invoices', () => {
  test('a registrant chooses a payment option and sees what it costs each way', async ({
    page,
  }) => {
    await page.goto(story('payment-options--deposit-choice'));
    await page.getByRole('radio', { name: '50% Deposit: $550.00' }).check();
    await expect(page.getByText('$563.75')).toBeVisible();
    await expect(page.getByText(/includes \$13\.75 handling/)).toBeVisible();
  });

  test('an invoice lists each refund under the payment it gives back from', async ({ page }) => {
    await page.goto(story('invoice-card--pay-pal-with-refund'));
    await expect(page.getByText('↳ Refund (PayPal)')).toBeVisible();
    await expect(page.getByText('Electronic payment handling')).toBeVisible();
  });

  test('a Reporter sees an invoice’s notes and can only copy its link', async ({ page }) => {
    await page.goto(story('invoice-card--as-a-reporter'));
    await expect(page.getByText('Invoice #2: Full Payment')).toBeVisible();
    // Only sharing its pay link; nothing that changes it.
    await expect(page.getByRole('button', { name: 'Copy pay link' })).toBeVisible();
    await expect(page.locator('#storybook-root button')).toHaveCount(1);
  });

  test('editing an invoice fills in the balance and the handling fee', async ({ page }) => {
    await page.goto(story('edit-invoice-modal--with-uninvoiced-balance'));
    await page.getByRole('button', { name: 'Use the balance' }).click();
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.getByRole('textbox', { name: 'Amount' })).toHaveValue('$1000');
    await expect(page.getByRole('textbox', { name: 'Electronic payment handling' })).toHaveValue(
      '$25',
    );
  });

  test('an invoice’s pay page shows what’s due and who it’s for', async ({ page }) => {
    await page.goto(story('invoice-summary--due'));
    await expect(page.getByText('Bob R., Jane R.', { exact: false })).toBeVisible();
    await expect(page.getByText('$1,425.00').first()).toBeVisible();
  });

  test('a registrar makes an invoice for the balance', async ({ page }) => {
    await page.goto(story('new-invoice-modal--for-the-balance'));
    await expect(page.getByRole('textbox', { name: 'Description' })).toHaveValue(
      'Registration balance',
    );
    await expect(page.getByRole('textbox', { name: 'Amount' })).toHaveValue('$1425');
  });
});

test.describe('Light or dark mode', () => {
  test('follows the system, remembers a choice, and can go back', async ({ page }) => {
    const scheme = page.locator('html');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(story('color-scheme-toggle--corner'));
    await expect(scheme).toHaveAttribute('data-mantine-color-scheme', 'light');

    // System follows the OS as it changes.
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(scheme).toHaveAttribute('data-mantine-color-scheme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(scheme).toHaveAttribute('data-mantine-color-scheme', 'light');

    // A choice overrides the OS and is remembered.
    await page.getByRole('button', { name: 'Light or dark mode: System' }).click();
    await page.getByRole('menuitem', { name: 'Dark' }).click();
    await expect(scheme).toHaveAttribute('data-mantine-color-scheme', 'dark');
    await page.reload();
    await expect(scheme).toHaveAttribute('data-mantine-color-scheme', 'dark');

    // System goes back to the OS.
    await page.getByRole('button', { name: 'Light or dark mode: Dark' }).click();
    await page.getByRole('menuitem', { name: 'System' }).click();
    await expect(scheme).toHaveAttribute('data-mantine-color-scheme', 'light');
  });
});
