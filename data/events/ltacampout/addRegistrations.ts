#!/usr/bin/env -S npx tsx --conditions=camphoric-source

/**
 * Add generated registrations to Jughandle Campout
 * ================================================
 *
 * Posts a batch of made-up registrations (1-3 campers each) to the Jughandle
 * Campout event (ltacampout/), through the public register endpoint, so the
 * admin screens and reports have a realistic amount of data to show. It
 * builds on testRegistrations.ts (the handful the importer posts)
 * and varies household make-up, ages, gender, lodging (tents, RVs, rooms,
 * suites and off-site), chores (under-5s are exempt), donations and comments.
 * Premium suites only go to households of two or more.
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
 *     COUNT=75 SEED=42 npm run bulk -w @camphoric/camphoric-event-ltacampout'
 *
 * In Docker (from the repo root, with the django service up; the data service
 * reaches it as http://django:8000 and gets the login from env/local/shared.env):
 *
 *   docker compose run --rm data npm run bulk -w @camphoric/camphoric-event-ltacampout
 *
 * See also the other events' addRegistrations.ts
 * (@camphoric/camphoric-event-harmony, @camphoric/camphoric-event-lark); the shared
 * plumbing is in @camphoric/camphoric-event-import-tools/bulk-registrations.
 */

import { main, lastNames, type Gen } from '@camphoric/camphoric-event-import-tools/bulk-registrations';
import { eventName } from './index.ts';
import { ageLookup } from './pricing/camperPricingLogic.ts';

const genders = ['Male', 'Female', 'Non-binary'];
const chores = ['Cleanup', 'Office Hours', 'Setup', 'Teardown'];
const howHeard = ['Lark Camp', 'A friend', 'Came last year', 'Mailing list'];
const comments = ['Arriving late Friday.', 'Happy to help with extra setup.', 'Bringing a guitar.'];

// Household shapes, by ageLookup keys
const households: (keyof typeof ageLookup)[][] = [
  [64], [49], [25], [65],
  [64, 64], [49, 49], [49, 25], [25, 25], [65, 65],
  [49, 11], [49, 4], [64, 17],
  [49, 49, 11], [49, 49, 4], [49, 17, 11], [25, 25, 25],
];

function makeRegistration(key: string, g: Gen) {
  const shape = g.pick(households);
  const lastName = g.pick(lastNames);
  const email = `${lastName.toLowerCase()}.${key}.campout@dontsend.com`;
  const phone = g.phone();
  // premium suites must be booked by two or more
  const lodging = g.lodging(path => shape.length > 1 || !path[0].startsWith('Premium'));
  const sharedWith = g.chance(0.2) ? g.fullName() : undefined;

  const campers = shape.map(age => ({
    first_name: g.fullName().split(' ')[0],
    last_name: lastName,
    gender: g.pick(genders),
    age: ageLookup[age],
    email,
    phone,
    chore: age === 4 ? 'Exempt' : g.pick(chores),
    lodging: {
      lodging_requested: { choices: lodging.choices, id: lodging.id, name: lodging.name },
      ...(sharedWith ? { lodging_shared: true, lodging_shared_with: sharedWith } : {}),
    },
  }));
  if (campers.length > 1 && g.chance(0.3)) campers[1].last_name = g.pick(lastNames);

  return {
    campers,
    registrant_email: email,
    lta_donation: g.chance(0.2) ? g.pick([10, 25, 50]) : 0,
    how_did_you_hear: g.chance(0.6) ? g.pick(howHeard) : '',
    comments: g.chance(0.2) ? g.pick(comments) : '',
  };
}

main({ eventName, makeRegistration });
