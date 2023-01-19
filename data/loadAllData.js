#!/usr/bin/env node

import larkCampout from './lark_campout/index.js';
import lark from './lark/index.js';
import { getAuthToken } from './getAuthInfo.js';
import loadOrganizations from './organizations/index.js';
import CamphoricEventCreator from './CamphoricEventCreator.js';

const urlBase = process.env.CAMPHORIC_URL || 'http://django:8000';

main();

const events = [
  larkCampout,
  lark,
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
