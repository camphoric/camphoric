#!/usr/bin/env node

/**
 * Print an event's confirmation and invitation email templates, as the
 * importer would load them, as JSON for `manage.py compare_email_templates`
 * (SPEC §8.3, §8.4).
 *
 * USAGE
 *
 *   node data/dump-email-templates.js harmony > server/harmony-emails.json
 */

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const cwd = path.dirname(fileURLToPath(import.meta.url));

const [,, dir] = process.argv;
if (!dir) {
  console.error('usage: dump-email-templates.js <event directory>');
  process.exit(2);
}

// Some event modules log while loading; keep stdout for the JSON.
const log = console.log;
console.log = () => {};
const { default: { data } } = await import(pathToFileURL(path.join(cwd, dir, 'index.js')).href);
console.log = log;

console.log(JSON.stringify({
  event: data.event.name,
  confirmation: {
    engine: data.event.confirmation_email_engine,
    subject: data.event.confirmation_email_subject,
    template: data.event.confirmation_email_template,
  },
  registration_types: (data.registration_types || []).map((type) => ({
    name: type.name,
    engine: type.invitation_email_engine,
    subject: type.invitation_email_subject,
    template: type.invitation_email_template,
  })),
}, null, 2));
