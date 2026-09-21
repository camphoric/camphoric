#!/usr/bin/env node

import 'dotenv/config';

import { getAuthToken } from './getAuthInfo.js';
import loadOrganizations from './organizations/index.js';
import CamphoricEventCreator from './CamphoricEventCreator.js';

const urlBase = process.env.CAMPHORIC_URL || 'http://django:8000';

// Every event directory, in import order. Restrict the run with
// CAMPHORIC_EVENTS=harmony,lark (comma-separated directory names).
const EVENT_DIRS = ['ltacampout', 'lark', 'familyweek', 'harmony'];

async function main() {
  const selected = process.env.CAMPHORIC_EVENTS
    ? process.env.CAMPHORIC_EVENTS.split(',').map(s => s.trim()).filter(Boolean)
    : EVENT_DIRS;

  const authToken = await getAuthToken();
  const organizations = await loadOrganizations(authToken, urlBase);

  for (const dir of selected) {
    // Import each event on demand, so a broken module fails with a clear
    // per-event error instead of taking every event down before anything runs.
    const { default: e } = await import(`./${dir}/index.js`);

    const event = new CamphoricEventCreator({
      ...e,
      organizations,
    });

    await event.create();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
