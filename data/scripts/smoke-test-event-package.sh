#!/bin/sh
# Smoke-test an event package as it would be published: build the spec and
# the event, pack them, install the tarballs into a fresh project (no
# registry needed for @camphoric: the spec tarball satisfies the event's peer
# range), then
# load the event from its build with plain Node (no tsx, no TypeScript
# source) and check what the importer relies on.
#
# The packed package.json still names the in-repo camphoric-source export,
# whose .ts source isn't packed; an event's own repository drops that export
# before publishing, so it's loaded here as an installed event will be:
# without that condition.
#
# Run from data/:  scripts/smoke-test-event-package.sh events/<name>
set -eu

cd "$(dirname "$0")/.."
DATA=$(pwd)
EVENT_DIR=${1:?usage: scripts/smoke-test-event-package.sh events/<name>}
EVENT=$(node -p "require('./$EVENT_DIR/package.json').name")
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

npm run --silent build -w @camphoric/camphoric-event-import-spec
npm run --silent build -w "$EVENT"
npm pack --silent --pack-destination "$TMP" \
  -w @camphoric/camphoric-event-import-spec -w "$EVENT" > /dev/null

cd "$TMP"
EVENT_TARBALL=$(ls ./*.tgz | grep -v 'camphoric-event-import-spec-')

# The tarball holds the build (and the report templates, when the event has
# them), not the bulk script, the tests or the configs.
tar -tzf "$EVENT_TARBALL" > files.txt
grep -q '^package/dist/index\.js$' files.txt
grep -q '^package/dist/index\.d\.ts$' files.txt
if [ -d "$DATA/$EVENT_DIR/reports" ]; then grep -q '^package/reports/' files.txt; fi
if grep -q -e '__tests__' -e 'addRegistrations' -e 'jest\.config' -e 'tsconfig' files.txt; then
  echo "$EVENT_TARBALL holds files it shouldn't:" >&2
  grep -e '__tests__' -e 'addRegistrations' -e 'jest\.config' -e 'tsconfig' files.txt >&2
  exit 1
fi

npm init -y > /dev/null
npm pkg set type=module
# Anything @camphoric the tarballs don't satisfy must fail against GitHub
# Packages, never resolve to npmjs.
cp "$DATA/.npmrc" .npmrc
npm install --silent --no-audit --no-fund ./camphoric-camphoric-event-import-spec-*.tgz "$EVENT_TARBALL"

# The event takes the spec as a peer, so it uses the project's copy
node -e "assert.ok(require('$EVENT/package.json').peerDependencies['@camphoric/camphoric-event-import-spec'])"
test ! -e "node_modules/$EVENT/node_modules/@camphoric/camphoric-event-import-spec"

EVENT="$EVENT" node --input-type=module -e "
import assert from 'node:assert/strict';
import { validateEventImport } from '@camphoric/camphoric-event-import-spec';

const mod = await import(process.env.EVENT);
const event = mod.default;
assert.match(import.meta.resolve(process.env.EVENT), /\/dist\/index\.js$/);
assert.deepEqual(validateEventImport(event.data), []);
assert.equal(event.organization.organization.name, event.data.organization);
for (const report of event.data.reports) assert.ok(report.template.trim(), report.title + ' has no template');

// Its overrides and sample registrations run from the build too
const lodging = new Proxy({}, { get: (_, key) => ({ id: 1, name: String(key) }) });
const results = { event: { id: 1 }, lodging };
const calls = [];
for (const override of event.overrides ?? []) {
  await override(async (...args) => { calls.push(args); return {}; }, results, () => {});
}
const regs = event.sampleRegGenerator ? await event.sampleRegGenerator(async () => ({}), results, () => {}) : [];
console.log(process.env.EVENT + ' loads from its build: ' + event.data.reports.length + ' reports, '
  + calls.length + ' override calls, ' + regs.length + ' sample registrations');
"
