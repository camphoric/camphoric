#!/usr/bin/env -S npx tsx

/**
 * USAGE
 *
 * 1. Run this util like ./replace-live-reports.ts <fromEventId> <toEventId>
 */

import Fetcher from 'camphoric-event-import-tools/fetcher';

// A report, as the reports API lists it
interface LiveReport {
  id: number;
  event: number;
  title: string;
  output: string;
  template: string;
  variables_schema: unknown;
  variables_source: string;
}

main();

async function main() {
  const [,,fromEventId, toEventId] = process.argv;

  const f = new Fetcher('https://harmonyreg.sffmc.org/');

  const data: LiveReport[] = await f.fetch('GET', '/api/reports/');

  await Promise.all(data.map(async (r) => {
    if (r.event.toString() !== toEventId) return;

    try {
      await f.fetch('DELETE', `/api/reports/${r.id}/`);
    } catch (e) {
      console.error(`failed to DELETE ${r.id}: '${r.title}'`);
      throw e;
    }
  }));

  await Promise.all(data.map(async (r) => {
    if (r.event.toString() !== fromEventId) return;

    const {
      title,
      output,
      template,
      variables_schema,
      variables_source,
    } = r;

    try {
      await f.fetch('POST', '/api/reports/', {
        title,
        output,
        template,
        variables_schema,
        // Without it, a copied legacy report would default to server variables.
        variables_source,
        event: toEventId,
      });
    } catch (e) {
      console.error(`failed to POST ${r.id}: '${r.title}'`);
    }

  }));

}

