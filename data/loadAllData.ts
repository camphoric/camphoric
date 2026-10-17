#!/usr/bin/env -S npx tsx

import 'dotenv/config';

import { getAuthToken } from 'camphoric-event-import-tools/auth';
import { Organizations, organizationLoader } from './organizations.ts';
import CamphoricEventCreator from './CamphoricEventCreator.ts';
import type { LoadedEventModule } from 'camphoric-event-import-spec';
import { EVENTS, selectedEvents } from './eventModules.ts';

const urlBase = process.env.CAMPHORIC_URL || 'http://django:8000';

// Every event in eventModules.ts, in import order. Restrict the run with
// CAMPHORIC_EVENTS=harmony,lark (comma-separated event names).
async function main() {
  const selected = selectedEvents();

  const authToken = await getAuthToken();
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
      sampleRegGenerator: e.sampleRegGenerator,
      overrides: e.overrides,
      organizations: new Organizations([organization]),
    });

    await event.create();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
