import type {
  ApiCamper,
  ApiEvent,
  ApiRegistration,
  AugmentedLodging,
  LodgingLookup,
  RegistrationTypeLookup,
} from 'api-types';
import { describe, expect, it } from 'vitest';

import { camperLodgingDetails } from '../camperLodgingDetails';

const event: Pick<ApiEvent, 'camper_schema' | 'registration_schema' | 'registration_ui_schema'> = {
  camper_schema: {
    type: 'object',
    properties: {
      first_name: { type: 'string', title: 'First name' },
      last_name: { type: 'string', title: 'Last name' },
      age: { type: 'string', title: 'Age', enum: ['adult', 'child'] },
      session: { type: 'string', title: 'Session' },
    },
  },
  registration_schema: {
    type: 'object',
    properties: {
      comments: { type: 'string', title: 'Comments' },
      how_did_you_hear: { type: 'string', title: 'How did you hear?' },
    },
  },
  registration_ui_schema: {
    comments: { 'ui:widget': 'textarea' },
    campers: { items: { age: { 'ui:enumNames': ['Adult', 'Child'] } } },
  },
};

const node = (id: number, pathParts: string[], isLeaf: boolean) =>
  ({ id, pathParts, fullPath: pathParts.join('→'), isLeaf }) as unknown as AugmentedLodging;

const lodgingLookup: LodgingLookup = {
  2: node(2, ['Camp 1', 'Cabin'], false),
  3: { ...node(3, ['Camp 1', 'Cabin', 'Cabin 05'], true), notes: 'Top bunk is broken' },
};

const registrationTypeLookup = {
  7: { id: 7, label: 'Staff' },
} as unknown as RegistrationTypeLookup;

const registration = {
  id: 20,
  registration_type: 7,
  attributes: { comments: 'Needs a lower bunk', how_did_you_hear: 'A friend' },
} as unknown as ApiRegistration;

const camper = (overrides: Partial<ApiCamper> = {}): ApiCamper =>
  ({
    id: 1,
    registration: 20,
    attributes: { first_name: 'Bob', last_name: 'Ross', age: 'adult', session: 'Full' },
    lodging: 3,
    lodging_requested: 2,
    lodging_shared: true,
    lodging_shared_with: 'Jane Ross',
    lodging_comments: 'Near the bathhouse',
    stay: ['2026-10-17', '2026-10-16'],
    ...overrides,
  }) as ApiCamper;

describe('camperLodgingDetails', () => {
  it('gathers what an admin needs to place the camper', () => {
    const details = camperLodgingDetails({
      camper: camper(),
      event,
      lodgingLookup,
      registration,
      registrationTypeLookup,
    });
    expect(details).toMatchObject({
      camperId: 1,
      name: 'Bob Ross',
      assigned: 'Camp 1 → Cabin → Cabin 05',
      stay: ['2026-10-16', '2026-10-17'],
      requested: 'Camp 1 → Cabin',
      shared: true,
      sharedWith: 'Jane Ross',
      lodgingComments: 'Near the bathhouse',
      unitNotes: 'Top bunk is broken',
      registrationType: 'Staff',
    });
  });

  it('takes the registration notes from its free-text fields only', () => {
    const details = camperLodgingDetails({ camper: camper(), event, lodgingLookup, registration });
    expect(details.registrationNotes).toEqual([{ label: 'Comments', text: 'Needs a lower bunk' }]);
  });

  it('shows the camper’s answers readably, without repeating their name', () => {
    const details = camperLodgingDetails({ camper: camper(), event, lodgingLookup });
    expect(details.attributes).toEqual([
      { label: 'Age', text: 'Adult' },
      { label: 'Session', text: 'Full' },
    ]);
  });

  it('reads a camper left on a requested branch as unassigned, with no stay', () => {
    const details = camperLodgingDetails({
      camper: camper({ lodging: 2, stay: null }),
      event,
      lodgingLookup,
    });
    expect(details.assigned).toBeNull();
    expect(details.stay).toEqual([]);
    expect(details.unitNotes).toBe('');
  });

  it('copes with no registration, type or request', () => {
    const details = camperLodgingDetails({
      camper: camper({ lodging: null, lodging_requested: null, lodging_shared: null }),
      event,
      lodgingLookup,
    });
    expect(details).toMatchObject({
      assigned: null,
      requested: null,
      shared: false,
      registrationType: null,
      registrationNotes: [],
    });
  });
});
