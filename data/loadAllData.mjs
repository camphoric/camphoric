#!/usr/bin/env node

import loadLark from './lark/loadData.mjs';
import loadLarkCampout from './lark_campout/loadData.mjs';
import { getAuthToken } from './getAuthInfo.mjs';
import loadOrganizations from './loadOrganizations.mjs';

main();

async function main() {
  const authToken = await getAuthToken();
  console.log('authToken', authToken);
  await loadOrganizations(authToken);
  await loadLark(authToken);
  await loadLarkCampout(authToken);
}
