#!/usr/bin/env node

import loadLark from './lark/loadData.mjs';
import loadLarkCampout from './lark_campout/loadData.mjs';

main();

async function main() {
  await loadLark();
  await loadLarkCampout();
}
