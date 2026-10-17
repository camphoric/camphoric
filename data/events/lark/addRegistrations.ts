#!/usr/bin/env -S npx tsx

/**
 * Add generated registrations to Lark Camp
 * ========================================
 *
 * Posts a batch of made-up registrations (1-3 campers each) to the Lark Camp
 * event, through the public register endpoint, so the admin screens and
 * reports have a realistic amount of data to show. It builds on
 * testRegistrations.ts (the handful the importer posts) and varies
 * household make-up, ages, gender, session (full or either half), meal plans
 * that fit the session, lodging (registrar's choice, or a camp, type and
 * area), parking passes that match the lodging, name badges, medical/response
 * volunteers, donations and comments.
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
 *     COUNT=75 SEED=42 npm run bulk -w camphoric-event-lark'
 *
 * In Docker (from the repo root, with the django service up; the data service
 * reaches it as http://django:8000 and gets the login from env/local/shared.env):
 *
 *   docker compose run --rm data npm run bulk -w camphoric-event-lark
 *
 * See also the other events' addRegistrations.ts
 * (camphoric-event-harmony, camphoric-event-ltacampout); the shared
 * plumbing is in camphoric-event-import-tools/bulk-registrations.
 */

import { main, lastNames, type Gen, type LodgingChoice } from 'camphoric-event-import-tools/bulk-registrations';
import { eventName } from './index.ts';
import { ageLookup, mealsLookup } from './pricing/camperPricingLogic.ts';
import { sessionTypes } from './camperSchema.ts';
import { mealTypes } from './camperMeals.ts';

const genders = ['Man', 'Woman', 'Nonbinary/other'];
const howHeard = ['A friend', 'Been coming for years', 'Facebook', 'Folk club newsletter', 'Saw a flyer'];
const comments = ['Please put us near the Camp 2 dance floor.', 'Can\'t wait!', 'Bringing a fiddle and a banjo.'];
const skills = ['Medical', 'Counseling/psychiatric', 'Emergency management', 'Firefighting'];

type Age = keyof typeof ageLookup;

// Household shapes, by ageLookup keys
const households: Age[][] = [
  [64], [49], [25], [65],
  [64, 64], [49, 49], [49, 25], [25, 25], [65, 64],
  [49, 11], [49, 4], [64, 17],
  [49, 49, 11], [49, 49, 4], [49, 17, 11], [64, 64, 17], [25, 25, 25],
];

// the meal plans each session offers (see camperSchema.ts `session` dependencies)
const sessionMeals: Record<string, string[]> = {
  [sessionTypes.F]: [mealsLookup.F, mealsLookup.D],
  [sessionTypes.A]: [mealsLookup.A],
  [sessionTypes.B]: [mealsLookup.B],
};

function makeCamper(
  g: Gen,
  age: Age,
  lastName: string,
  session: string,
  lodging: LodgingChoice,
  sharedWith?: string,
) {
  const first_name = g.fullName().split(' ')[0];
  const adult = age >= 25;
  const plans = sessionMeals[session];
  const meal_plan = g.chance(0.75) ? g.pick(plans) : 'No meals';

  return {
    first_name,
    last_name: lastName,
    gender: g.pick(genders),
    age: ageLookup[age],
    session,
    meals: meal_plan === 'No meals'
      ? { meal_plan }
      : { meal_plan, meal_type: g.pick([...mealTypes, mealTypes[0]]) },
    address_different_than_payer: false,
    name_badge: adult && g.chance(0.4)
      ? { purchase: true, name: first_name, ...(g.chance(0.4) ? { pronouns: g.pick(['she/her', 'he/him', 'they/them']) } : {}) }
      : { purchase: false },
    good_samaritan: adult && g.chance(0.08)
      ? { volunteer: true, skills: [g.pick(skills)], credentials: g.pick(['RN', 'EMT-B', 'MD', 'LCSW', 'CERT']) }
      : { volunteer: false },
    parking_passes: [] as ReturnType<typeof parkingPass>[],
    lodging: {
      lodging_requested: { choices: lodging.choices, id: lodging.id, name: lodging.name },
      ...(sharedWith ? { lodging_shared: true, lodging_shared_with: sharedWith } : {}),
    },
  };
}

// a pass for the household's vehicle, matched to where it's camping
function parkingPass(g: Gen, lodging: { path: string[] }) {
  const [camp, type, size] = lodging.path;
  const campNo = camp?.match(/^Camp (\d)$/)?.[1];

  if (type === 'RV') {
    // passes only come in two RV sizes; anything longer takes the larger one
    const vehicle_type = size === 'RV under 15\' long' ? size : 'RV 15\'-20\' long';
    return { vehicle_type, pass_type: `Vehicle Camp ${campNo}` };
  }
  return {
    vehicle_type: 'Regular car',
    pass_type: campNo && g.chance(0.5) ? `Camp ${campNo}` : g.pick(['Long Term', 'Long Term', 'Short Term', 'Park Anywhere']),
  };
}

function makeRegistration(key: string, g: Gen) {
  const shape = g.pick(households);
  const lastName = g.pick(lastNames);
  const email = `${lastName.toLowerCase()}.${key}.lark@dontsend.com`;
  const roll = g.rand();
  const session = roll < 0.7 ? sessionTypes.F : roll < 0.85 ? sessionTypes.A : sessionTypes.B;
  const lodging = g.lodging();
  const sharedWith = g.chance(0.2) ? g.fullName() : undefined;

  const campers = shape.map(age => makeCamper(g, age, lastName, session, lodging, sharedWith));
  if (campers.length > 1 && g.chance(0.3)) campers[1].last_name = g.pick(lastNames);
  // an RV household always brings its RV (sometimes a car too); others mostly drive in
  if (lodging.path[1] === 'RV' || g.chance(0.7)) {
    campers[0].parking_passes = [parkingPass(g, lodging)];
    if (lodging.path[1] === 'RV' && g.chance(0.2)) campers[0].parking_passes.push(parkingPass(g, { path: [] }));
  }

  const address = g.address();
  return {
    registrant_email: email,
    payment: {
      payer_first_name: campers[0].first_name,
      payer_last_name: campers[0].last_name,
      payer_number: g.phone(),
      payer_billing_address: { ...address, country: 'United States' },
    },
    campers,
    lta_donation: g.chance(0.2) ? g.pick([10, 25, 50, 100]) : 0,
    how_did_you_hear: g.chance(0.6) ? g.pick(howHeard) : '',
    comments: g.chance(0.2) ? g.pick(comments) : '',
  };
}

main({ eventName, makeRegistration });
