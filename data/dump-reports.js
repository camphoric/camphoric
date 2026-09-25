#!/usr/bin/env node

/**
 * Print an event's reports, as the importer would load them, as JSON for
 * `manage.py compare_report_templates` — a temporary tool for converting
 * data/ reports to server variables (DR-41).
 *
 * USAGE
 *
 *   node data/dump-reports.js harmony > server/harmony-reports.json
 */

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const cwd = path.dirname(fileURLToPath(import.meta.url));

const [,, dir] = process.argv;
if (!dir) {
  console.error('usage: dump-reports.js <event directory>');
  process.exit(2);
}

// Some event modules log while loading; keep stdout for the JSON.
const log = console.log;
console.log = () => {};
const { default: { data } } = await import(pathToFileURL(path.join(cwd, dir, 'index.js')).href);
console.log = log;

console.log(JSON.stringify((data.reports || []).map((report) => ({
  title: report.title,
  output: report.output,
  variables_source: report.variables_source || 'client',
  template: report.template,
})), null, 2));
