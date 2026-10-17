/**
 * Every event the importer loads, by short name, in import order. Each one is
 * imported on demand, so a broken module fails only its own event.
 */

import type { LoadedEventModule } from 'camphoric-event-import-spec';

export const EVENTS = {
  ltacampout: () => import('camphoric-event-ltacampout'),
  lark: () => import('camphoric-event-lark'),
  familyweek: () => import('camphoric-event-familyweek'),
  harmony: () => import('camphoric-event-harmony'),
} satisfies Record<string, () => Promise<LoadedEventModule>>;

export type EventName = keyof typeof EVENTS;

const PACKAGE_PREFIX = 'camphoric-event-';

/**
 * The events to import: those CAMPHORIC_EVENTS names (comma-separated short
 * names, such as harmony,lark, or package names), in the order given, or
 * every event.
 */
export function selectedEvents(filter = process.env.CAMPHORIC_EVENTS): EventName[] {
  if (!filter) return Object.keys(EVENTS) as EventName[];

  return filter.split(',').map(s => s.trim()).filter(Boolean).map((given) => {
    const name = given.startsWith(PACKAGE_PREFIX) ? given.slice(PACKAGE_PREFIX.length) : given;

    if (!Object.hasOwn(EVENTS, name)) {
      throw new Error(
        `CAMPHORIC_EVENTS names an unknown event '${given}'; the events are ${Object.keys(EVENTS).join(', ')}`,
      );
    }

    return name as EventName;
  });
}
