import { expect, test } from '@camphoric/camphoric-event-import-tools/e2e';

import { ages } from '../pricing/camperPricingLogic.ts';
import pricing from '../pricing/pricing.ts';
import { deposit } from '../registrationDepositSchema.ts';
import registrationSchema from '../registrationSchema.ts';

// The registration form, as a registrant fills it in, through the
// import-tools page object (RegistrationForm). Every test shares the one
// imported event, so a completed registration stays, taking a lodging spot.

// (The form's heading is its schema's title)
test('the form opens under its title', async ({ page, registration }) => {
  await registration.open();
  await expect(page.getByRole('heading', { name: registrationSchema.title, exact: true })).toBeVisible();
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

test('a registration goes through, paying a deposit by check', async ({ page, registration }) => {
  await registration.open();
  await registration.fill('Registrant email', 'e2e.household@example.com');
  const camper = registration.camper(1);
  await camper.fill('First name', 'Robin');
  await camper.fill('Last name', 'Example');
  await camper.chooseLodging('Day Visitor');
  await registration.fill('Street address', '1 Example Lane');
  await registration.fill('City', 'Exampleton');
  await registration.fill('State or province', 'CA');
  await registration.fill('ZIP or postal code', '90000');
  await registration.expectTotal(pricing.adult_day);

  await registration.submit();
  await registration.expectPaymentStep();
  await registration.choosePaymentOption(deposit.name);
  await registration.payByCheck();
  await expect(page).toHaveURL(/\/register\/finished$/);
});
