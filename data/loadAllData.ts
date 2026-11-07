#!/usr/bin/env -S npx tsx --conditions=camphoric-source

import 'dotenv/config';

import {
  ApiTokenError, assertLocalServer, getAuthToken, revokeAuthToken,
} from '@camphoric/camphoric-event-import-tools/auth';
import CamphoricEventCreator from '@camphoric/camphoric-event-import-tools/creator';
import { Organizations, organizationLoader } from '@camphoric/camphoric-event-import-tools/organizations';
import { validateEventImport, type LoadedEventModule } from '@camphoric/camphoric-event-import-spec';
import { EVENTS, selectedEvents, type EventName } from './eventModules.ts';
import { importOptions, serverEventNames, waitForServer } from './importOptions.ts';

const urlBase = process.env.CAMPHORIC_URL || 'http://django:8000';

// Run as a retry hint when an --if-empty import fails
const RETRY = 'If an import into a fresh database failed partway, start again with ./data/reset-data-and-test (it flushes the database first).';

// Every event in eventModules.ts, in import order, with the API token in
// CAMPHORIC_API_TOKEN (or the file CAMPHORIC_API_TOKEN_FILE names). Restrict
// the run with CAMPHORIC_EVENTS=harmony,lark (comma-separated event names).
// Options: --if-empty imports only into a server with no events, --wait waits
// for the server to start first, and --revoke-token revokes the token when
// the run ends. Only a local server is imported into, unless
// CAMPHORIC_ALLOW_REMOTE=1.
async function main() {
  const { ifEmpty, wait, revokeToken } = importOptions(process.argv.slice(2));
  const selected = selectedEvents();

  // (Getting the token checks this too, but a remote server shouldn't be
  // waited for)
  assertLocalServer(urlBase);

  if (wait) await waitForServer(urlBase);

  // (Read once the server answers: the development stack's mints it as it starts)
  const authToken = await getAuthToken(urlBase);

  // A run that fails before here has sent its token nowhere
  try {
    await importEvents(authToken, selected, ifEmpty);
  } finally {
    if (revokeToken) await revokeRunToken(authToken);
  }
}

async function importEvents(authToken: string, selected: EventName[], ifEmpty: boolean) {
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
      // (The run's one token, which --revoke-token revokes)
      token: authToken,
    });

    await event.create();
  }
}

// Revoke the run's token (--revoke-token), however the run went. Failing to
// is reported and fails the run, without hiding why an import failed.
async function revokeRunToken(authToken: string) {
  try {
    const outcome = await revokeAuthToken(urlBase, authToken);
    console.log(outcome === 'revoked' ? 'Revoked the API token (--revoke-token).' : 'The API token had already ended.');
  } catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  // (A token problem says what to do about it; a stack wouldn't help)
  console.error(e instanceof ApiTokenError ? e.message : e);
  if (process.argv.includes('--if-empty') && !(e instanceof ApiTokenError)) console.error(RETRY);
  process.exit(1);
});
