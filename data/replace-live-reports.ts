#!/usr/bin/env -S npx tsx --conditions=camphoric-source

/**
 * USAGE
 *
 * Replace one event's reports with copies of another's, on the server at
 * CAMPHORIC_URL (usually production):
 *
 *     CAMPHORIC_ALLOW_REMOTE=1 CAMPHORIC_URL=https://<server> \
 *       ./replace-live-reports.ts <fromEventId> <toEventId>
 *
 * shows what it would do; add --yes to do it. It logs in as
 * DJANGO_SUPERUSER_USERNAME / DJANGO_SUPERUSER_PASSWORD, and asks for them when
 * neither is set.
 *
 * The importer's tools refuse to log in to a server that isn't local, so a
 * live server also needs CAMPHORIC_ALLOW_REMOTE=1. Set it on the command line:
 * the script doesn't set it for itself, so pointing at a live server stays a
 * choice made each time.
 *
 * It copies every report first, and deletes the target event's old reports
 * only once all the copies are saved. On any failure it exits non-zero, naming
 * what it did, so it can be cleaned up.
 */

import Fetcher from '@camphoric/camphoric-event-import-tools/fetcher';
import {
  camphoricUrl, describePlan, planReplacement, replaceOptions, replaceReports, type LiveReport,
} from './replaceLiveReports.ts';

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function main() {
  const options = replaceOptions(process.argv.slice(2));
  const url = camphoricUrl();

  const f = new Fetcher(url);

  const reports: LiveReport[] = await f.fetch('GET', '/api/reports/');
  const plan = planReplacement(reports, options);

  if (!options.yes) {
    console.log([
      `On ${url}, this would:`,
      ...describePlan(plan, options),
      'Run it again with --yes to do it.',
    ].join('\n'));
    return;
  }

  await replaceReports(f, plan, options.toEventId);
}
