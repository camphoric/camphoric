#!/usr/bin/env node

import BACDS from '../organizations/bacds.js';
import CamphoricEventCreator from '../CamphoricEventCreator.js';
import familyWeek from './index.js';
import { getAuthToken } from '../getAuthInfo.js';
import { Organizations, loadOrganization } from '../organizations/index.js';

const urlBase = process.env.CAMPHORIC_URL || 'http://django:8000';

main();

async function main() {
  const authToken = await getAuthToken();
  const organization = await loadOrganization(BACDS, authToken, urlBase);
  const event = new CamphoricEventCreator({
    ...familyWeek,
    organizations: new Organizations([organization]),
  });
  await event.create();
}
