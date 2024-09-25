#!/usr/bin/env node

import 'dotenv/config';

import ltacampout from './ltacampout/index.js';
import lark from './lark/index.js';
import familyWeek from './familyweek/index.js';
import harmony from './harmony/index.js';
import { getAuthToken } from './getAuthInfo.js';
import loadOrganizations from './organizations/index.js';
import CamphoricEventCreator from './CamphoricEventCreator.js';

const urlBase = process.env.CAMPHORIC_URL || 'http://django:8000';

main();

const events = [
  // ltacampout,
  // lark,
  // familyWeek,
  harmony
];

async function main() {
  const authToken = await getAuthToken();
  const organizations = await loadOrganizations(authToken, urlBase);

  for(const e of events) {
    const event = new CamphoricEventCreator({
      ...e,
      organizations,
    });

    await event.create();
  }
}
