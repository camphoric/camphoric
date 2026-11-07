#!/bin/sh
# Smoke-test the published form of the shared event-import packages: build
# them, pack them as npm publish would, install the tarballs into a fresh
# project (no registry needed: each tarball satisfies the other's range), then
# use them with plain Node (no tsx, no TypeScript source) and type-check a
# consumer against their declarations.
#
# Run from data/:  scripts/smoke-test-packages.sh
set -eu

cd "$(dirname "$0")/.."
DATA=$(pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

npm run --silent build
npm pack --silent --pack-destination "$TMP" \
  -w @camphoric/camphoric-event-import-spec -w @camphoric/camphoric-event-import-tools > /dev/null

cd "$TMP"

# The tarballs hold the build and the source it maps to, not the tests or
# the build config.
for tarball in *.tgz; do
  tar -tzf "$tarball" > "$tarball.files"
  grep -q '^package/dist/.*\.js$' "$tarball.files"
  grep -q '^package/dist/.*\.d\.ts$' "$tarball.files"
  if grep -q -e '__tests__' -e 'tsconfig\.build\.json' -e 'jest\.config' "$tarball.files"; then
    echo "$tarball holds files it shouldn't:" >&2
    grep -e '__tests__' -e 'tsconfig\.build\.json' -e 'jest\.config' "$tarball.files" >&2
    exit 1
  fi
done
grep -q '^package/tsconfig\.base\.json$' camphoric-camphoric-event-import-spec-*.tgz.files
# The compose file the e2e harness's throwaway server comes from, and the
# fake PayPal it runs
grep -q '^package/e2e-compose\.yml$' camphoric-camphoric-event-import-tools-*.tgz.files
grep -q '^package/e2eFakePayPal\.py$' camphoric-camphoric-event-import-tools-*.tgz.files

npm init -y > /dev/null
npm pkg set type=module
# @playwright/test is the e2e harness's optional peer, at the version this
# repository uses (no browsers are installed: nothing launches one)
PLAYWRIGHT=$(node -p "require('$DATA/node_modules/@playwright/test/package.json').version")
npm install --silent --no-audit --no-fund ./camphoric-camphoric-event-import-spec-*.tgz \
  ./camphoric-camphoric-event-import-tools-*.tgz "@playwright/test@$PLAYWRIGHT"

# Plain Node, through the packages' default (dist/) exports
node --input-type=module -e "
import assert from 'node:assert/strict';
import { EventImportSchema, validateEventImport } from '@camphoric/camphoric-event-import-spec';
import Fetcher from '@camphoric/camphoric-event-import-tools/fetcher';
import { authorization, getAuthToken } from '@camphoric/camphoric-event-import-tools/auth';
import CamphoricEventCreator from '@camphoric/camphoric-event-import-tools/creator';
import { Organizations, organizationLoader } from '@camphoric/camphoric-event-import-tools/organizations';

assert.equal(typeof EventImportSchema, 'object');
assert.notDeepEqual(validateEventImport({}), []);
assert.deepEqual(validateEventImport({
  organization: 'Test', event: { name: 'Test' }, reports: [], registration_types: [],
}), []);
assert.equal(typeof Fetcher, 'function');
assert.equal(typeof getAuthToken, 'function');
assert.deepEqual(authorization('cmph_token'), { Authorization: 'Bearer cmph_token' });
assert.equal(typeof organizationLoader, 'function');
assert.ok(new Organizations([{ id: 1, name: 'Org' }]).byName.Org);
// The creator checks the data with the validator it's given, before any request
assert.throws(() => new CamphoricEventCreator({
  data: { organization: 'Org', event: { name: 'Test' }, reports: [], registration_types: [] },
  validate: validateEventImport,
  organizations: new Organizations([{ id: 1, name: 'Org' }]),
  overrides: 'not a list',
}), /overrides/);
assert.throws(() => new CamphoricEventCreator({
  data: {}, validate: () => ['bad'], organizations: new Organizations([]),
}), /did not pass/);
// The e2e harness loads, with its parts
const e2e = await import('@camphoric/camphoric-event-import-tools/e2e');
for (const name of ['defineEventE2EConfig', 'setUpEvent', 'camphoricServer', 'importForE2E', 'RegistrationForm',
  'ListQuestion', 'CamphoricAdmin', 'FakePayPal', 'test', 'expect']) {
  assert.ok(e2e[name], 'e2e exports ' + name);
}
assert.equal(e2e.defineEventE2EConfig({ globalSetup: './setup.ts' }).globalSetup, './setup.ts');
console.log('the packed packages load and validate under plain Node');
"

# A consumer type-checks against the packed declarations
cat > check.ts <<'TS'
import type { EventImport, EventModule } from '@camphoric/camphoric-event-import-spec';
import type { LoadedEventModule } from '@camphoric/camphoric-event-import-spec';
import type { describeEventModule } from '@camphoric/camphoric-event-import-spec/conformance';
import { validateEventImport } from '@camphoric/camphoric-event-import-spec';
import { defineEventE2EConfig, expect, setUpEvent, test } from '@camphoric/camphoric-event-import-tools/e2e';

const data = {
  organization: 'Test',
  event: { name: 'Test' },
  reports: [{ title: 'All', template: '', output: 'csv' }],
  registration_types: [],
} satisfies EventImport;

export const event = {
  data,
  organization: { organization: { name: 'Test' }, emailAccount: {} },
} satisfies EventModule;

export type Load = Parameters<typeof describeEventModule>[0];
export const load: Load = async (): Promise<LoadedEventModule> => ({ default: event });

// An event repository's e2e setup and tests, against the packed declarations
export const config = defineEventE2EConfig({ globalSetup: './e2e/global-setup.ts' });
export const setup = setUpEvent({ event, validate: validateEventImport, onlinePayment: true });
test('the form opens', async ({ registration }) => {
  await registration.open();
  const camper = registration.camper(1);
  const [lodging] = await camper.chooseLodging('Cabins');
  expect(lodging).toContain('Cabins');
  await expect(camper.lodgingLevels()).toHaveCount(2);
  await registration.expectTotal(100);
  const pass = await camper.list('Parking Passes').add();
  await pass.select('Vehicle Type', 'Regular car');
  await registration.removeCamper(2);
});
test('payment, invitations and email', async ({ page, registration, admin, payPal }) => {
  const invitation = await admin.invite('staff', { send: true });
  await page.goto(invitation.registerUrl);
  const [email] = await admin.emails({ to: invitation.email, kind: 'invitation' });
  expect(email.subject).toBeTruthy();
  const online: number = await registration.paymentTotal('online');
  const order = await payPal.order(await registration.startOnlinePayment('Card'));
  expect(order.amount).toBe(online.toFixed(2));
});
TS
"$DATA/node_modules/.bin/tsc" --noEmit --strict \
  --module nodenext --moduleResolution nodenext --types node --typeRoots "$DATA/node_modules/@types" check.ts
echo 'a consumer type-checks against the packed declarations'
