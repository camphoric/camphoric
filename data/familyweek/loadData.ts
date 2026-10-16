#!/usr/bin/env -S npx tsx

import BACDS from '../organizations/bacds.ts';
import CamphoricEventCreator from '../CamphoricEventCreator.ts';
import familyWeek from './index.ts';
import { getAuthToken } from '../getAuthInfo.ts';
import { Organizations, loadOrganization } from '../organizations/index.ts';

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
