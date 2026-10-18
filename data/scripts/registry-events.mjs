#!/usr/bin/env node
// Prints the events the importer installs from npm (published from
// repositories of their own), one package name per line, with the range
// data/package.json gives each: every @camphoric/camphoric-event-* dependency
// that isn't a workspace (which the lockfile marks as a link).
//
// Run from data/:  node scripts/registry-events.mjs
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));

for (const [name, range] of Object.entries(pkg.dependencies ?? {})) {
  if (name.startsWith('@camphoric/camphoric-event-') && !lock.packages[`node_modules/${name}`]?.link) {
    console.log(`${name} ${range}`);
  }
}
