#!/usr/bin/env node

// import loadLark from './lark/loadData.mjs';
import larkCampout from './lark_campout';
import { getAuthToken } from './getAuthInfo.mjs';
import loadOrganizations from './organizations';
import CamphoricEventCreator from '../loadEvent.mjs';

const urlBase = process.env.CAMPHORIC_URL || 'http://django:8000';

main();

const events = [
  larkCampout,
];

async function main() {
  const authToken = await getAuthToken();
  console.log('authToken', authToken);
  const organizations = await loadOrganizations(authToken, urlBase);

  for(const e in events) {
    const event = new CamphoricEventCreator({
      ...e,
      organizations,
    });
  }

  // await loadLark(authToken, auth);
  // await loadLarkCampout(authToken);
}
