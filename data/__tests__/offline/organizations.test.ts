/**
 * Events that name the same organization declare it identically (Lark Camp
 * and the Jughandle Campout share Lark Traditional Arts, from repositories of
 * their own). The importer creates an organization once, from the first
 * event that declares it, so a second, different declaration would be
 * ignored.
 */

import { expect, test } from '@jest/globals';
import type { OrganizationImport } from '@camphoric/camphoric-event-import-spec';

import { EVENTS, type EventName } from '../../eventModules.ts';

// An organization's email account comes from environment variables. Here
// each CAMPHORIC_* variable reads as its own name, set or not, so two
// declarations match only if they read the same variables.
// (Jest loads this file's modules afresh, so no other suite sees this.)
process.env = new Proxy(process.env, {
  get: (target, key) => (typeof key === 'string' && key.startsWith('CAMPHORIC_')
    ? `$${key}` : Reflect.get(target, key)),
});

test('events that name the same organization declare it identically', async () => {
  const declarations = new Map<string, { event: EventName, organization: OrganizationImport }[]>();
  for (const event of Object.keys(EVENTS) as EventName[]) {
    const { organization } = (await EVENTS[event]()).default;
    const { name } = organization.organization;
    declarations.set(name, [...declarations.get(name) ?? [], { event, organization }]);
  }

  for (const [, [first, ...others]] of declarations) {
    for (const other of others) {
      expect(other).toEqual({ event: other.event, organization: first.organization });
    }
  }
  // Lark Camp and the Jughandle Campout are compared, and read their email
  // account from the environment
  const lta = declarations.get('Lark Traditional Arts') ?? [];
  expect(lta.map(({ event }) => event).sort()).toEqual(['lark', 'ltacampout']);
  expect(lta[0].organization.emailAccount?.username).toMatch(/^\$CAMPHORIC_/);
});
