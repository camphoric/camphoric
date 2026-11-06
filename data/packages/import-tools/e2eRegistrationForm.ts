/**
 * The public registration form (/events/:id/register), for an event's e2e
 * tests. The client's markup is only known here, so a change to the client
 * changes this page object, not every event's tests.
 */

import { expect, type Locator, type Page } from '@playwright/test';

// The client's ordinals (1st, 2nd, 3rd, 4th, 11th, 21st, …), as its "Nth
// Camper" headings use them
function ordinal(n: number): string {
  const ones = n % 10;
  const tens = n % 100;
  if (ones === 1 && tens !== 11) return `${n}st`;
  if (ones === 2 && tens !== 12) return `${n}nd`;
  if (ones === 3 && tens !== 13) return `${n}rd`;
  return `${n}th`;
}

// The price ticker's text for an amount, as the client formats it
const money = (amount: number) => amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A label's whole text, with or without a required question's asterisk
const labelled = (label: string) => new RegExp(`^${escapeRegExp(label)}(\\s*\\*)?$`);

// Opens a dropdown (whatever state it's in), returning its list of choices
async function open(page: Page, dropdown: Locator): Promise<Locator> {
  const list = page.getByRole('listbox').filter({ visible: true });
  await dropdown.click();
  if (!await list.isVisible()) await dropdown.click();
  await expect(list).toBeVisible();
  return list;
}

// Picks a choice in a dropdown, and waits until it shows it, returning the
// choices the dropdown offered. (Opening a dropdown and closing it without a
// pick can leave it ignoring the next pick, so choices are only read while
// picking.)
async function pick(page: Page, dropdown: Locator, choice: string): Promise<string[]> {
  const list = await open(page, dropdown);
  const choices = await list.getByRole('option').allTextContents();
  await list.getByRole('option', { name: choice, exact: true }).click();
  await expect(dropdown).toHaveValue(choice);
  return choices;
}

/** The questions of one part of the form (the whole form, or a camper's). */
export class FormSection {
  readonly page: Page;
  readonly root: Locator;

  constructor(page: Page, root: Locator) {
    this.page = page;
    this.root = root;
  }

  /**
   * A question's control, by its label (its title in the event's schema); a
   * required question's label ends with an asterisk, which needn't be given.
   */
  field(label: string | RegExp): Locator {
    return this.root.getByLabel(typeof label === 'string' ? labelled(label) : label);
  }

  /** Types into a text, number, email, date or phone question. */
  async fill(label: string | RegExp, value: string): Promise<void> {
    await this.field(label).fill(value);
  }

  /** Picks a choice in a single-choice question shown as a dropdown. */
  async select(label: string | RegExp, choice: string): Promise<void> {
    await pick(this.page, this.field(label), choice);
  }

  /** Checks a checkbox, a radio button or one of a question's checkboxes. */
  async check(label: string | RegExp): Promise<void> {
    await this.field(label).check();
  }

  /** A message shown with the questions, such as a validation error. */
  message(text: string | RegExp): Locator {
    return this.root.getByText(text);
  }

  /**
   * A list question (an array of objects in the event's schema, such as a
   * camper's parking passes), by its title: its items, and adding and
   * removing them. A camper's list is the camper's: `camper(n).list(title)`
   * (on the whole form, every camper's list has that title).
   */
  list(title: string): ListQuestion {
    // The list's own title (its heading, a child of the list's box), not
    // that of a list inside one of its items
    const heading = this.page.locator(':scope > h3').filter({ hasText: new RegExp(`^${escapeRegExp(title)}$`) });
    return new ListQuestion(this.page, this.root.locator('.rjsf-field-array').filter({ has: heading }));
  }
}

/** A list question's items, each with questions of its own (FormSection.list). */
export class ListQuestion {
  readonly page: Page;
  readonly root: Locator;

  constructor(page: Page, root: Locator) {
    this.page = page;
    this.root = root;
  }

  /** Its items, in order: count them with `expect(list.items()).toHaveCount(n)`. */
  items(): Locator {
    return this.root.locator(':scope > .rjsf-array-item-list > .rjsf-array-item');
  }

  /** The nth item's questions (from 1). */
  item(n: number): FormSection {
    return new FormSection(this.page, this.items().nth(n - 1));
  }

  /** Adds an item (its "Add …" button), returning its questions. */
  async add(): Promise<FormSection> {
    const count = await this.items().count();
    await this.root.locator(':scope > * > .rjsf-array-item-add').click();
    await expect(this.items()).toHaveCount(count + 1);
    return this.item(count + 1);
  }

  /** Removes the nth item (from 1), with its × button. */
  async remove(n: number): Promise<void> {
    const count = await this.items().count();
    await this.items().nth(n - 1).locator(':scope > .rjsf-array-item-toolbar')
      .getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(this.items()).toHaveCount(count - 1);
  }
}

/** One camper's questions, under its "1st Camper", "2nd Camper", … heading. */
export class CamperSection extends FormSection {
  /**
   * Chooses lodging by walking its dropdowns from the top: each name is the
   * choice at one level, e.g. chooseLodging('Meadow Cabins', 'Cabin 1').
   * Returns the choices each level offered, e.g. to check that a node
   * registrants mustn't see isn't among them.
   */
  async chooseLodging(...names: string[]): Promise<string[][]> {
    const offered: string[][] = [];
    for (const [level, name] of names.entries()) {
      offered.push(await pick(this.page, this.lodgingDropdown(level), name));
    }
    return offered;
  }

  /**
   * The lodging dropdowns the camper is shown now, one per level: the top
   * one, then one under each chosen lodging that has choices of its own. To
   * check that a lodging offers no choices below it:
   *
   *     await camper.chooseLodging('Tent');
   *     await expect(camper.lodgingLevels()).toHaveCount(1);
   *
   * Count them, don't click them: a dropdown opened and closed without a pick
   * can leave it ignoring the next pick (choose with chooseLodging instead).
   */
  lodgingLevels(): Locator {
    return this.root.locator('.field-lodging-requested input:not([type="hidden"])');
  }

  // The lodging dropdown at a level (0 is the top)
  private lodgingDropdown(level: number): Locator {
    return this.lodgingLevels().nth(level);
  }
}

export class RegistrationForm extends FormSection {
  readonly eventId: number;

  constructor(page: Page, eventId: number) {
    super(page, page.locator('form').first());
    this.eventId = eventId;
  }

  /** Opens the form (its registration step) and waits for it. */
  async open(): Promise<void> {
    await this.page.goto(`/events/${this.eventId}/register`);
    const closed = this.page.getByText('Registration is closed');
    await expect(this.root.or(closed)).toBeVisible();
    if (await closed.isVisible()) {
      throw new Error('registration is closed for this event: import it with its registration open (the default)');
    }
    await expect(this.page).toHaveURL(new RegExp(`/events/${this.eventId}/register/registration$`));
  }

  /** The nth camper's questions (from 1), under its "1st Camper", … heading. */
  camper(n: number): CamperSection {
    const heading = this.page.getByRole('heading', { name: `${ordinal(n)} Camper`, exact: true });
    return new CamperSection(this.page, this.page.locator('.camphoric-camper').filter({ has: heading }));
  }

  /** Adds another camper, returning its questions. */
  async addCamper(): Promise<CamperSection> {
    const count = await this.page.locator('.camphoric-camper').count();
    await this.page.getByRole('button', { name: `Add a ${ordinal(count + 1)} Camper` }).click();
    return this.camper(count + 1);
  }

  /**
   * Removes the nth camper (from 1), with the Remove button by its heading;
   * the campers after it move up (the 3rd becomes the 2nd).
   */
  async removeCamper(n: number): Promise<void> {
    const count = await this.page.locator('.camphoric-camper').count();
    // (The heading's row, not the Remove buttons of the camper's lists)
    await this.camper(n).root.locator(':scope > .mantine-Group-root')
      .getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(this.page.locator('.camphoric-camper')).toHaveCount(count - 1);
  }

  /** Waits until the price ticker shows this total (in dollars). */
  async expectTotal(amount: number): Promise<void> {
    await expect(this.page.getByText(/^Total: /)).toHaveText(`Total: ${money(amount)}`);
  }

  /** The total the price ticker shows now, in dollars (see expectTotal). */
  async total(): Promise<number> {
    const ticker = this.page.getByText(/^Total: /);
    await expect(ticker).toBeVisible();
    const text = (await ticker.textContent()) ?? '';
    return Number(text.replace(/[^0-9.-]/g, ''));
  }

  /** Submits the registration step (the form's "Continue to payment"). */
  async submit(): Promise<void> {
    // (An "already sent" notice above the form has a button of the same name)
    await this.root.getByRole('button', { name: 'Continue to payment', exact: true }).click();
  }

  /** After submitting: the payment step has opened. */
  async expectPaymentStep(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`/events/${this.eventId}/register/payment`));
  }

  /** On the payment step: chooses a payment option by its title. */
  async choosePaymentOption(title: string): Promise<void> {
    await this.page.getByRole('radio', { name: new RegExp(`^${escapeRegExp(title)}:`) }).check();
  }

  /** On the payment step: pays by check, completing the registration. */
  async payByCheck(): Promise<void> {
    await this.page.getByRole('button', { name: /by check$/ }).click();
  }

  /**
   * On the payment step: what the chosen payment option costs, in dollars,
   * as it shows it: by check (the default), or online, which adds the
   * event's e-payment handling (shown only when the event takes payments
   * online: import it with `onlinePayment`).
   */
  async paymentTotal(how: 'check' | 'online' = 'check'): Promise<number> {
    const due = this.page.getByRole('table', { name: 'Amount due now' });
    const row = due.getByRole('row').filter({ hasText: how === 'check' ? /^By check/ : /^Online/ });
    const amount = row.getByRole('cell').last();
    await expect(amount).toBeVisible();
    return Number(((await amount.textContent()) ?? '').replace(/[^0-9.-]/g, ''));
  }

  /**
   * On the payment step of an event imported with `onlinePayment`: presses
   * a PayPal button ('PayPal', or 'Card' for "Debit or Credit Card"), which
   * completes the registration and has the server create its PayPal order,
   * and returns the order's id. The fake PayPal's window then stays open: the
   * payer never approves, so nothing is paid. Read what the order asked for
   * with the `payPal` fixture's `order(id)`.
   */
  async startOnlinePayment(button: 'PayPal' | 'Card' = 'PayPal'): Promise<string> {
    const name = button === 'Card' ? 'Debit or Credit Card' : 'PayPal';
    const created = this.page.waitForResponse((response) => {
      const request = response.request();
      // (With an invitation, the form posts with its code in the query)
      if (request.method() !== 'POST' || new URL(response.url()).pathname !== `/api/events/${this.eventId}/register`) {
        return false;
      }
      try {
        return (request.postDataJSON() as { step?: string } | null)?.step === 'paypal-order';
      } catch {
        return false;
      }
    });
    await this.page.locator('[data-camphoric-e2e-paypal]')
      .getByRole('button', { name, exact: true }).click();
    const response = await created;
    const body = await response.json() as { orderID?: string, detail?: string };
    if (!response.ok() || !body.orderID) {
      throw new Error(`the server didn't create a PayPal order (${response.status()}): ${body.detail ?? JSON.stringify(body)}`);
    }
    return body.orderID;
  }
}
