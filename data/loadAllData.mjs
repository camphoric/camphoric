#!/usr/bin/env node

import loadLark from './lark/loadData.mjs';
import loadLarkCampout from './lark_campout/loadData.mjs';
import getAuthInfo, { getAuthToken } from './getAuthInfo.mjs';

main();

async function main() {
  const authInfo = await getAuthInfo();
  const authToken = await getAuthToken();
  console.log('authInfo', authInfo);
  console.log('authToken', authToken);
  await loadLark(authToken);
  await loadLarkCampout(authToken);
}
