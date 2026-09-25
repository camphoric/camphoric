/**
 * Build a legacy report's variables, and render the Handlebars reports, with
 * the v2 client's own code — a temporary tool for converting data/ reports to
 * server variables (DR-41). The variables are built exactly as
 * `useReportTemplateVars` builds them (src/hooks/useReportData.ts)
 * and JSON round-tripped as the render POST does.
 *
 * USAGE (from client_v2/, so its Vite aliases resolve):
 *
 *   LADLE=1 npx vite-node scripts/legacy-report-outputs.mjs report-api-data.json > legacy.json
 *
 * where report-api-data.json comes from `manage.py dump_report_api_data`.
 * Prints `{ bundle, handlebars: { <title>: <markdown> } }`.
 */

import fs from 'fs';

import {
  buildCamperLookup,
  buildLodgingTree,
  buildRegistrationLookup,
  buildRegistrationTypeLookup,
  flattenLodgingTree,
} from 'store/augmented';
import { processHandlebarsTemplate } from 'components/templating/pipeline';

const [file] = process.argv.slice(2);
if (!file) {
  console.error('usage: legacy-report-outputs.mjs <report-api-data.json>');
  process.exit(2);
}

const api = JSON.parse(fs.readFileSync(file, 'utf8'));
const eventId = String(api.event.id);

const registrationTypeLookup = buildRegistrationTypeLookup(api.registrationTypes);
const registrationLookup = buildRegistrationLookup(
  api.registrations,
  api.campers,
  api.payments,
  registrationTypeLookup,
  eventId,
);
const camperLookup = buildCamperLookup(api.registrations, api.campers, eventId);
const lodgingLookup = flattenLodgingTree(buildLodgingTree(api.lodgings, api.campers, eventId));

// What the render POST sends: the bundle as JSON.
const bundle = JSON.parse(JSON.stringify({
  event: api.event,
  registrations: Object.values(registrationLookup),
  registrationLookup,
  campers: Object.values(camperLookup),
  camperLookup,
  lodgingLookup,
  registrationTypeLookup,
}));

// Handlebars reports render in the browser: template → markdown (then HTML).
const handlebars = {};
for (const report of api.reports) {
  if (report.output === 'hbs') {
    handlebars[report.title] = processHandlebarsTemplate(report.template, bundle);
  }
}

process.stdout.write(JSON.stringify({ bundle, handlebars }));
