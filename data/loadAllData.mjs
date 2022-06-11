#!/usr/bin/env node

import loadLark from './lark/LoadData';
import loadLarkCampout from './lark_campout/LoadData';

main();

async function main() {
  await loadLark();
  await loadLarkCampout();
}
