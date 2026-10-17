#!/usr/bin/env -S npx tsx --conditions=camphoric-source

import 'dotenv/config';

import { getAuthToken } from '@camphoric/camphoric-event-import-tools/auth';
import CamphoricEventCreator from '@camphoric/camphoric-event-import-tools/creator';
import { Organizations, organizationLoader } from '@camphoric/camphoric-event-import-tools/organizations';
import { validateEventImport, type LoadedEventModule } from '@camphoric/camphoric-event-import-spec';
import { EVENTS, selectedEvents } from './eventModules.ts';
import { importOptions, serverEventNames, waitForServer } from './importOptions.ts';

const urlBase = process.env.CAMPHORIC_URL || 'http://django:8000';

// Run as a retry hint when an --if-empty import fails
const RETRY = 'If an import into a fresh database failed partway, start again with ./data/reset-data-and-test (it flushes the database first).';

// Every event in eventModules.ts, in import order. Restrict the run with
// CAMPHORIC_EVENTS=harmony,lark (comma-separated event names). Options:
// --if-empty imports only into a server with no events, and --wait waits for
// the server to start first.
async function main() {
  const { ifEmpty, wait } = importOptions(process.argv.slice(2));
  const selected = selectedEvents();

  if (wait) await waitForServer(urlBase);

  const authToken = await getAuthToken();

  if (ifEmpty) {
    const existing = await serverEventNames(urlBase, authToken);
    if (existing.size) {
      console.log(`${urlBase} already has events, so nothing is imported (--if-empty). ${RETRY}`);
      return;
    }
  }

  const organizationFor = organizationLoader(authToken, urlBase);

  for (const name of selected) {
    // Import each event on demand, so a broken module fails with a clear
    // per-event error instead of taking every event down before anything runs.
    const { default: e }: LoadedEventModule = await EVENTS[name]();

    // An installed (compiled) event isn't type-checked here, so check the
    // organization it declares before using it.
    if (e.organization?.organization?.name !== e.data?.organization) {
      throw new Error(
        `event '${name}' must declare the organization its data names ('${e.data?.organization}'), `
        + `not '${e.organization?.organization?.name}'`,
      );
    }

    const organization = await organizationFor(e.organization);

    const event = new CamphoricEventCreator({
      data: e.data,
      validate: validateEventImport,
      sampleRegGenerator: e.sampleRegGenerator,
      overrides: e.overrides,
      organizations: new Organizations([organization]),
    });

    await event.create();
  }
}

main().catch((e) => {
  console.error(e);
  if (process.argv.includes('--if-empty')) console.error(RETRY);
  process.exit(1);
});
