import { randomBytes } from 'node:crypto';

import { expect, type RegistrationForm, test } from '@camphoric/camphoric-event-import-tools/e2e';

import { confirmation_email_subject } from '../confirmationEmailTemplate.ts';
import { ages } from '../pricing/camperPricingLogic.ts';
import pricing from '../pricing/pricing.ts';
import { deposit } from '../registrationDepositSchema.ts';
import registrationSchema from '../registrationSchema.ts';
import registrationTypes from '../registrationTypes.ts';

// The registration form, as a registrant fills it in, through the
// import-tools page object (RegistrationForm). Every test shares the one
// imported event, so a completed registration stays, taking a lodging spot.

// (The form's heading is its schema's title)
test('the form opens under its title', async ({ page, registration }) => {
  await registration.open();
  await expect(page.getByRole('heading', { name: registrationSchema.title, exact: true })).toBeVisible();
});

// The week's schedule is wider than a phone's screen: it scrolls in a box of
// its own, so the page keeps to the screen's width (and never scrolls
// sideways, where a tap can land on the wrong question)
test('the form fits the screen\'s width', async ({ page, registration, isMobile }) => {
  await registration.open();
  const schedule = page.getByRole('table').filter({ hasText: 'Workshops' });
  await expect(schedule).toBeVisible();
  if (isMobile) {
    expect((await schedule.boundingBox())?.width).toBeGreaterThan(page.viewportSize()?.width ?? 0);
  }

  const overflows = (el: { scrollWidth: number, clientWidth: number }) => el.scrollWidth > el.clientWidth;
  expect(await page.locator('html').evaluate(overflows)).toBe(false);
});

test('lodging offers only the choices registrants see', async ({ registration }) => {
  await registration.open();
  const offered = await registration.camper(1).chooseLodging('Meadow Cabins', 'Cabin 1');
  // (in alphabetical order; the Staff Cabin is hidden from registrants)
  expect(offered).toEqual([
    ['Day Visitor', 'Meadow Cabins', 'Tent Field'],
    ['Cabin 1', 'Cabin 2', 'Cabin 3'],
  ]);
});

test('a lodging with choices of its own opens another level', async ({ registration }) => {
  await registration.open();
  const camper = registration.camper(1);
  await expect(camper.lodgingLevels()).toHaveCount(1);

  await camper.chooseLodging('Meadow Cabins');
  await expect(camper.lodgingLevels()).toHaveCount(2);

  // Changing the top choice to one with nothing below it closes the level
  await camper.chooseLodging('Day Visitor');
  await expect(camper.lodgingLevels()).toHaveCount(1);
});

test('each camper has lodging levels of their own', async ({ registration }) => {
  await registration.open();
  await registration.camper(1).chooseLodging('Tent Field');
  const second = await registration.addCamper();
  await expect(registration.camper(1).lodgingLevels()).toHaveCount(2);
  await expect(second.lodgingLevels()).toHaveCount(1);
});

// An adult and a youth in a cabin, a T-shirt, and a donation
test('a household is priced from the pricing table', async ({ registration }) => {
  await registration.open();
  const adult = registration.camper(1);
  await adult.chooseLodging('Meadow Cabins', 'Cabin 2');
  await registration.expectTotal(pricing.adult_cabin);

  const youth = await registration.addCamper();
  await youth.select('Age at the start of camp', ages.youth);
  await youth.chooseLodging('Meadow Cabins', 'Cabin 2');
  await youth.check('I would like a camp T-shirt');
  await youth.select('Size', 'Medium');
  await registration.fill('Scholarship fund donation (dollars)', '30');

  const total = pricing.adult_cabin + pricing.youth_cabin + pricing.t_shirt + 30;
  await registration.expectTotal(total);
  expect(await registration.total()).toBe(total);
});

test('a registration missing required answers isn\'t submitted', async ({ page, registration }) => {
  await registration.open();
  // (So the camper's first name is the first unanswered question)
  await registration.fill('Registrant email', 'e2e.unfinished@example.com');
  const firstName = registration.camper(1).field('First name');
  await expect(firstName).not.toBeFocused();

  await registration.submit();
  // Stopping the submit takes the registrant to the unanswered question
  await expect(firstName).toBeFocused();
  await expect(firstName).toHaveJSProperty('validity.valueMissing', true);
  await expect(page).toHaveURL(/\/register\/registration$/);
});

test('a camper is removed, and the campers after them move up', async ({ registration }) => {
  await registration.open();
  await registration.camper(1).chooseLodging('Day Visitor');
  const second = await registration.addCamper();
  await second.fill('First name', 'Second');
  await second.chooseLodging('Day Visitor');
  const third = await registration.addCamper();
  await third.fill('First name', 'Third');
  await third.chooseLodging('Day Visitor');
  await registration.expectTotal(3 * pricing.adult_day);

  await registration.removeCamper(2);
  await expect(registration.camper(2).field('First name')).toHaveValue('Third');
  await expect(registration.camper(3).root).toHaveCount(0);
  await registration.expectTotal(2 * pricing.adult_day);
});

test('a camper\'s parking passes are added and removed', async ({ registration }) => {
  await registration.open();
  const passes = registration.camper(1).list('Parking passes');
  await expect(passes.items()).toHaveCount(0);

  const car = await passes.add();
  await car.fill('License plate', 'CAR1');
  const rv = await passes.add();
  await rv.select('Vehicle', 'RV');
  await rv.fill('License plate', 'RV2');
  await expect(passes.items()).toHaveCount(2);

  await passes.remove(1);
  await expect(passes.items()).toHaveCount(1);
  await expect(passes.item(1).field('Vehicle')).toHaveValue('RV');
  await expect(passes.item(1).field('License plate')).toHaveValue('RV2');
  // (The camper is still there: only the pass was removed)
  await expect(registration.camper(1).root).toHaveCount(1);
});

// A new address each time, so a test finds only its own email
const newEmail = (name: string) => `e2e.${name}.${randomBytes(4).toString('hex')}@example.com`;

// One adult day visitor, every required answer given
async function fillHousehold(registration: RegistrationForm, email: string) {
  await registration.open();
  await registration.fill('Registrant email', email);
  const camper = registration.camper(1);
  await camper.fill('First name', 'Robin');
  await camper.fill('Last name', 'Example');
  await camper.chooseLodging('Day Visitor');
  await registration.fill('Street address', '1 Example Lane');
  await registration.fill('City', 'Exampleton');
  await registration.fill('State or province', 'CA');
  await registration.fill('ZIP or postal code', '90000');
  await registration.expectTotal(pricing.adult_day);
}

test('a registration goes through, paying a deposit by check', async ({ page, registration, admin }) => {
  const email = newEmail('household');
  await fillHousehold(registration, email);

  await registration.submit();
  await registration.expectPaymentStep();
  await registration.choosePaymentOption(deposit.name);
  expect(await registration.paymentTotal()).toBe(50);
  await registration.payByCheck();
  await expect(page).toHaveURL(/\/register\/finished$/);

  // The confirmation email went to the registrant
  const [confirmation, ...others] = await admin.emails({ to: email });
  expect(others).toEqual([]);
  expect(confirmation).toMatchObject({ kind: 'confirmation', status: 'sent', subject: confirmation_email_subject });
  expect(confirmation.text).toContain('Robin');
});

// Sample Camp adds 2.5% handling to an online payment (its epayment_handling)
test('paying online adds the handling, and PayPal is asked for that total', async ({ registration, payPal }) => {
  await fillHousehold(registration, newEmail('online'));
  await registration.submit();
  await registration.expectPaymentStep();

  expect(await registration.paymentTotal('check')).toBe(pricing.adult_day);
  expect(await registration.paymentTotal('online')).toBe(61.5);
  await registration.choosePaymentOption(deposit.name);
  expect(await registration.paymentTotal('check')).toBe(50);
  const online = await registration.paymentTotal('online');
  expect(online).toBe(51.25);

  const order = await payPal.order(await registration.startOnlinePayment());
  // (to the cent, as PayPal takes amounts)
  expect(order).toMatchObject({ amount: online.toFixed(2), currency: 'USD' });
});

const staff = registrationTypes[0];

test('an invitation opens the form for its registration type', async ({ page, admin }) => {
  const invitation = await admin.invite(staff.name, { name: 'Sam Staff', send: true });

  // Its email has the link to the form with its code
  const [sent] = await admin.emails({ to: invitation.email, kind: 'invitation' });
  expect(sent).toMatchObject({ status: 'sent', subject: staff.invitation_email_subject });
  expect(sent.text).toContain(`code=${invitation.code}`);

  await page.goto(invitation.registerUrl);
  // Staff are told they arrive early, and register one person at a time
  await expect(page.getByText('Staff arrive two days before camp.')).toBeVisible();
  await expect(page.getByRole('heading', { name: '1st Camper', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add a 2nd Camper' })).toHaveCount(0);
});
