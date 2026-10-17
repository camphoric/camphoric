/**
 * Every event the importer loads, by short name, in import order. Each one is
 * imported on demand, so a broken module fails only its own event.
 */

import type { LoadedEventModule } from '@camphoric/camphoric-event-import-spec';

export const EVENTS = {
  ltacampout: () => import('@camphoric/camphoric-event-ltacampout'),
  lark: () => import('@camphoric/camphoric-event-lark'),
  familyweek: () => import('@camphoric/camphoric-event-familyweek'),
  harmony: () => import('@camphoric/camphoric-event-harmony'),
  'sample-camp': () => import('@camphoric/camphoric-event-sample-camp'),
} satisfies Record<string, () => Promise<LoadedEventModule>>;

export type EventName = keyof typeof EVENTS;

// An event's package name, scoped or not, ahead of its short name
const PACKAGE_PREFIX = /^(@camphoric\/)?camphoric-event-/;

/**
 * The events to import: those CAMPHORIC_EVENTS names (comma-separated short
 * names, such as harmony,lark, or package names), in the order given, or
 * every event.
 */
export function selectedEvents(filter = process.env.CAMPHORIC_EVENTS): EventName[] {
  if (!filter) return Object.keys(EVENTS) as EventName[];

  return filter.split(',').map(s => s.trim()).filter(Boolean).map((given) => {
    const name = given.replace(PACKAGE_PREFIX, '');

    if (!Object.hasOwn(EVENTS, name)) {
      throw new Error(
        `CAMPHORIC_EVENTS names an unknown event '${given}'; the events are ${Object.keys(EVENTS).join(', ')}`,
      );
    }

    return name as EventName;
  });
}
