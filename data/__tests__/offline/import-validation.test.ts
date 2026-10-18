/**
 * Offline validation of every event the importer loads (eventModules.ts) — no
 * server needed.
 *
 * Each event must pass the conformance checks every event package runs
 * (@camphoric/camphoric-event-import-spec/conformance), so an event that is installed
 * here, rather than developed here, is held to them too. The event, as its
 * overrides leave it, must also pass the server's form and pricing checks
 * (server/camphoric/schema_checks.py, run with python3): no default outside
 * its choices, and no text or choice answer the pricing reads that a
 * registration may lack (#771). Those need this repository's server/, so they
 * live here rather than in the event packages.
 *
 * Runs under native ESM (jest.config.cjs: TypeScript compiled by @swc/jest,
 * with its imports left as ESM) because the event modules use import.meta.url
 * and ESM-only dependencies.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from '@jest/globals';
import { describeEventModule, importedEvent } from '@camphoric/camphoric-event-import-spec/conformance';

import { EVENTS, type EventName } from '../../eventModules.ts';

// The server's own checks, run on an event's fields (DR-106). They need the
// repository's server/ and python3. Outside CI they're skipped (saying why)
// where those are missing, as in the data container, which mounts only data/.
// In CI they always run, so a moved file or a missing python3 fails the job
// instead of quietly turning the check off.
const SCHEMA_CHECKS = fileURLToPath(
  new URL('../../../server/camphoric/schema_checks.py', import.meta.url),
);
const canRunSchemaChecks = process.env.CI === 'true' || (existsSync(SCHEMA_CHECKS)
  && spawnSync('python3', ['--version']).status === 0);
const schemaTest = canRunSchemaChecks ? test : test.skip;

describe.each(Object.keys(EVENTS) as EventName[])('data/%s', (name) => {
  const load = EVENTS[name];

  describeEventModule(load);

  schemaTest(
    canRunSchemaChecks
      ? "passes the server's form and pricing checks"
      : "passes the server's form and pricing checks (skipped: needs server/ and python3)",
    async () => {
      const event = await importedEvent((await load()).default);
      const output = execFileSync('python3', [SCHEMA_CHECKS], { input: JSON.stringify(event) });
      expect(JSON.parse(output.toString())).toEqual({});
    },
  );
});
