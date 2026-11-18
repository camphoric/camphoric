/**
 * Every event the importer loads, by short name, in import order: the events
 * under events/ (Sample Camp), then any other event package installed in
 * node_modules, such as a camp's, installed by hand (`npm install --no-save
 * @camphoric/camphoric-event-<name>`). Each one is imported on demand, so a
 * broken module fails only its own event.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';

import type { LoadedEventModule } from '@camphoric/camphoric-event-import-spec';

// An event's package name, scoped or not, ahead of its short name
const PACKAGE_PREFIX = /^(@camphoric\/)?camphoric-event-/;

const DATA = new URL('./', import.meta.url);

const folders = (dir: URL) => (existsSync(dir)
  ? readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory() || entry.isSymbolicLink())
    .map(entry => entry.name)
  : []);

// The package names of the workspaces under a folder of data/
const workspaces = (dir: string) => folders(new URL(`${dir}/`, DATA))
  .map(name => new URL(`${dir}/${name}/package.json`, DATA))
  .filter(manifest => existsSync(manifest))
  .map(manifest => JSON.parse(readFileSync(manifest, 'utf8')).name as string);

// The events under events/, each a folder named for its event
const local = workspaces('events').map(name => name.replace(PACKAGE_PREFIX, ''));

// The shared packages under packages/ (the spec, import-tools), which aren't events
const shared = new Set(workspaces('packages'));

// The event packages installed beside them: the events/ workspaces' links
// and any other @camphoric/camphoric-event-* package
const installed = folders(new URL('node_modules/@camphoric/', DATA))
  .filter(name => PACKAGE_PREFIX.test(name) && !shared.has(`@camphoric/${name}`))
  .map(name => name.replace(PACKAGE_PREFIX, ''))
  .filter(name => !local.includes(name))
  .sort();

export type EventName = string;

export const EVENTS: Record<EventName, () => Promise<LoadedEventModule>> = Object.fromEntries(
  [...local, ...installed].map(name => [name, () => import(`@camphoric/camphoric-event-${name}`)]),
);

/**
 * The events to import: those CAMPHORIC_EVENTS names (comma-separated short
 * names, such as sample-camp, or package names), in the order given, or
 * every event.
 */
export function selectedEvents(filter = process.env.CAMPHORIC_EVENTS): EventName[] {
  if (!filter) return Object.keys(EVENTS);

  return filter.split(',').map(s => s.trim()).filter(Boolean).map((given) => {
    const name = given.replace(PACKAGE_PREFIX, '');

    if (!Object.hasOwn(EVENTS, name)) {
      throw new Error(
        `CAMPHORIC_EVENTS names an unknown event '${given}'; the events are ${Object.keys(EVENTS).join(', ')}`
          + ' (install a camp\'s event with npm install --no-save @camphoric/camphoric-event-<name>)',
      );
    }

    return name;
  });
}
