#!/usr/bin/env node

import loadLark from './lark/LoadData.mjs';
import loadLarkCampout from './lark_campout/LoadData.mjs';

main();

async function main() {
  await loadLark();
  await loadLarkCampout();
}
