#!/usr/bin/env node

import loadLark from './lark/loadData.mjs';
import loadLarkCampout from './lark_campout/loadData.mjs';
import getAuthInfo from './getAuthInfo.mjs';

main();

async function main() {
  const authInfo = await getAuthInfo();
  console.log('authInfo', authInfo);
  await loadLark(authInfo);
  await loadLarkCampout(authInfo);
}
