#!/usr/bin/env node

/**
 * USAGE
 *
 * 1. Run this util like ./replace-live-reports.js <fromEventId> <toEventId>
 */

import Fetcher from './CamphoricFetcher.js';

main();

async function main() {
  const [,,fromEventId, toEventId] = process.argv;

  const f = new Fetcher('https://harmonyreg.sffmc.org/');

  const data = await f.fetch('GET', '/api/reports/');

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
    } = r;

    try {
      await f.fetch('POST', '/api/reports/', {
        title,
        output,
        template,
        variables_schema,
        event: toEventId,
      });
    } catch (e) {
      console.error(`failed to POST ${r.id}: '${r.title}'`);
    }

  }));

}

