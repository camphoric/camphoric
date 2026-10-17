#!/usr/bin/env -S npx tsx --conditions=camphoric-source

/**
 * Add generated registrations to Camp Harmony
 * ===========================================
 *
 * Posts a batch of made-up registrations (1-3 campers each) to the Camp
 * Harmony event, through the public register endpoint, so the admin screens
 * and reports have a realistic amount of data to show. It builds on
 * testRegistrations.ts (the handful the importer posts) and varies
 * household make-up, ages, lodging, nights attended, driving, meals and
 * dietary needs, linens, single rooms, camperships, donations and comments.
 * Every registration is completed choosing to pay by check; then, as if the
 * checks came in, about half are recorded as paid in full and a fifth as part
 * paid, leaving the rest with their whole balance due.
 *
 * The event must already exist (data/'s npm run import imports it). The script only
 * adds registrations — it never clears any — so each run adds another batch,
 * and re-running an interrupted run with the same SEED repeats the ones it
 * had already posted. Every registrant email ends in @dontsend.com, but each
 * completed registration still queues a confirmation email, so run it where
 * mail goes to the console (as in local dev), not through a real mail server.
 *
 * Settings (environment variables)
 * --------------------------------
 *   COUNT        registrations to add (default 75)
 *   SEED         random seed; the same seed makes the same people (default 42).
 *                The seed is part of each email, so batches with different
 *                seeds never share one.
 *   PAID_SHARE        share recorded as paid in full (default 0.5)
 *   PART_PAID_SHARE   share recorded as part paid (default 0.2)
 *   CAMPHORIC_URL                 server to post to (default http://django:8000)
 *   DJANGO_SUPERUSER_USERNAME,
 *   DJANGO_SUPERUSER_PASSWORD     an admin login, to look the event up
 *                                 (prompted for when neither is set)
 *
 * Running it
 * ----------
 * On the Vagrant VM (the repo is mounted at /vagrant; dev admin login is
 * admin/admin):
 *
 *   vagrant ssh -c 'cd /vagrant/data && CAMPHORIC_URL=http://localhost:8000 \
 *     DJANGO_SUPERUSER_USERNAME=admin DJANGO_SUPERUSER_PASSWORD=admin \
 *     COUNT=75 SEED=42 npm run bulk -w @camphoric/camphoric-event-harmony'
 *
 * In Docker (from the repo root, with the django service up; the data service
 * reaches it as http://django:8000 and gets the login from env/local/shared.env):
 *
 *   docker compose run --rm data npm run bulk -w @camphoric/camphoric-event-harmony
 *
 * See also the other events' addRegistrations.ts
 * (@camphoric/camphoric-event-lark, and camphoric/camphoric-event-ltacampout's); the shared
 * plumbing is in @camphoric/camphoric-event-import-tools/bulk-registrations.
 */

import { main, lastNames, type Gen, type LodgingChoice } from '@camphoric/camphoric-event-import-tools/bulk-registrations';
import { eventName } from './index.ts';
import { ageLookup } from './pricing/camperPricingLogic.ts';
import { days } from './camperSchema.ts';

const mealExceptions = ['Gluten Free', 'Dairy Free', 'Whole Grain'];
const healthNotes = ['Bee sting allergy', 'Uses a CPAP', 'Asthma, carries inhaler', 'Bad knee, prefers ground floor'];
const dietNotes = ['Peanut allergy', 'No shellfish', 'Low sodium', 'Allergic to tree nuts'];
const comments = ['Looking forward to it!', 'Can we be near the dance hall?', 'First time bringing the kids.'];

type AgeKey = keyof typeof ageLookup;

// Household shapes, by camper ages (keys of ageLookup)
const households: AgeKey[][] = [
  ['adult'],
  ['adult'],
  ['yadult'],
  ['adult', 'adult'],
  ['adult', 'adult'],
  ['adult', 'yadult'],
  ['yadult', 'yadult'],
  ['adult', 'child'],
  ['adult', 'baby'],
  ['adult', 'adult', 'child'],
  ['adult', 'child', 'child'],
  ['adult', 'adult', 'baby'],
  ['adult', 'yadult', 'child'],
  ['yadult', 'yadult', 'yadult'],
];

function makeCamper(
  g: Gen,
  ageKey: AgeKey,
  lastName: string,
  email: string,
  phone: string,
  lodging: LodgingChoice,
  attendance: string[],
  sharedWith?: string,
) {
  const adult = ageKey === 'adult' || ageKey === 'yadult';
  const driving = adult ? g.pick(['Driver', 'Passenger', 'Not sure yet']) : 'Passenger';
  const first_time = g.chance(0.2);

  return {
    first_name: g.fullName().split(' ')[0],
    last_name: lastName,
    age: g.pick(ageLookup[ageKey]),
    email,
    phone,
    first_time,
    ...(first_time && g.chance(0.6) ? { referer: g.fullName() } : {}),
    driving,
    ...(driving === 'Driver' ? {
      license_plate: `${g.int(1, 9)}ABC${g.int(100, 999)}`,
      mobile_phone: g.phone(),
      disabled_parking: g.chance(0.1),
    } : {}),
    attendance,
    meal_type: g.pick(['Omnivore', 'Omnivore', 'Vegetarian', 'Vegan']),
    meal_exceptions: g.chance(0.25) ? [g.pick(mealExceptions)] : [],
    ...(g.chance(0.15) ? { meal_exceptions_other: g.pick(dietNotes) } : {}),
    ...(g.chance(0.1) ? { health_conditions: g.pick(healthNotes) } : {}),
    emergency_contact: { name: g.fullName(), phone: g.phone() },
    linens: adult && g.chance(0.3),
    lodging_private: lodging.name === 'Village 7' && g.chance(0.3),
    campership_request: g.chance(0.1) ? g.pick([5, 10, 20]) : 0,
    lodging: {
      lodging_requested: { choices: lodging.choices, id: lodging.id, name: lodging.name },
      ...(sharedWith ? { lodging_shared: true, lodging_shared_with: sharedWith } : {}),
    },
  };
}

function makeRegistration(key: string, g: Gen) {
  const shape = g.pick(households);
  const lastName = g.pick(lastNames);
  const email = `${lastName.toLowerCase()}.${key}.harmony@dontsend.com`;
  const phone = g.phone();
  const lodging = g.lodging();

  // most come for all nights; some arrive late or leave early
  const roll = g.rand();
  const attendance = roll < 0.65 ? days
    : roll < 0.8 ? days.slice(0, g.int(2, 4))
      : days.slice(g.int(1, 2));

  const sharedWith = g.chance(0.15) ? g.fullName() : undefined;
  const campers = shape.map(age => makeCamper(g, age, lastName, email, phone, lodging, attendance, sharedWith));
  // a household mostly shares a surname; sometimes a partner has their own
  if (campers.length > 1 && g.chance(0.3)) campers[1].last_name = g.pick(lastNames);

  return {
    campers,
    registrant_email: email,
    address: g.address(),
    is_member: true,
    ...(g.chance(0.15) ? { campership_donation: g.pick([10, 25, 50, 100]) } : {}),
    comments: g.chance(0.2) ? g.pick(comments) : '',
  };
}

main({ eventName, makeRegistration });
