import type {
  ApiCamper,
  ApiLodging,
  ApiPayment,
  ApiRegistration,
  ApiRegistrationType,
} from 'api-types';
import { describe, expect, it } from 'vitest';

import {
  buildCamperLookup,
  buildLodgingTree,
  buildRegistrationLookup,
  buildRegistrationTypeLookup,
  flattenLodgingTree,
} from './augmented';

const reg = (over: Partial<ApiRegistration> & { id: number }): ApiRegistration =>
  ({
    event: 1,
    registration_type: 0,
    payment_type: 'PayPal',
    server_pricing_results: { total: 0, campers: [] },
    ...over,
  }) as ApiRegistration;

const camper = (over: Partial<ApiCamper> & { id: number }): ApiCamper =>
  ({ registration: 1, attributes: {}, ...over }) as ApiCamper;

const payment = (over: Partial<ApiPayment>): ApiPayment => ({ registration: 1, ...over }) as ApiPayment;

const lodging = (over: Partial<ApiLodging> & { id: number; name: string }): ApiLodging =>
  ({ event: 1, parent: null, capacity: 0, ...over }) as ApiLodging;

describe('buildRegistrationTypeLookup', () => {
  it('keys registration types by stringified id', () => {
    const types = [{ id: 4, name: 'a' }, { id: 7, name: 'b' }] as ApiRegistrationType[];
    expect(buildRegistrationTypeLookup(types)['7'].name).toBe('b');
  });
});

describe('buildRegistrationLookup', () => {
  it('augments event registrations with campers, type, and money totals', () => {
    const registrations = [
      reg({ id: 1, registration_type: 4, server_pricing_results: { total: 300, campers: [] } }),
      reg({ id: 2, event: 999 }), // different event — excluded
    ];
    const campers = [camper({ id: 10, registration: 1 }), camper({ id: 11, registration: 2 })];
    const payments = [
      payment({ registration: 1, amount: 100 }),
      payment({ registration: 1, amount: 50 }),
    ];
    const typeLookup = buildRegistrationTypeLookup([{ id: 4, name: 'Full' } as ApiRegistrationType]);

    const lookup = buildRegistrationLookup(registrations, campers, payments, typeLookup, '1');

    expect(Object.keys(lookup)).toEqual(['1']);
    const r = lookup['1'];
    expect(r.total_owed).toBe(300);
    expect(r.total_payments).toBe(150);
    expect(r.total_balance).toBe(150);
    expect(r.registrationType?.name).toBe('Full');
    expect(r.campers.map((c) => c.id)).toEqual([10]);
  });
});

describe('buildCamperLookup', () => {
  it('includes only campers of completed registrations for the event', () => {
    const registrations = [
      reg({ id: 1, payment_type: 'Check' }),
      reg({ id: 2, payment_type: undefined }), // incomplete — campers excluded
      reg({ id: 3, event: 999, payment_type: 'PayPal' }), // other event
    ];
    const campers = [
      camper({ id: 10, registration: 1 }),
      camper({ id: 11, registration: 2 }),
      camper({ id: 12, registration: 3 }),
    ];

    const lookup = buildCamperLookup(registrations, campers, '1');

    expect(Object.keys(lookup)).toEqual(['10']);
  });
});

describe('buildLodgingTree / flattenLodgingTree', () => {
  it('builds the tree with counts, capacity, and full paths', () => {
    const lodgings = [
      lodging({ id: 1, name: 'Camp', parent: null, capacity: 0 }),
      lodging({ id: 2, name: 'Cabin A', parent: 1, capacity: 4 }),
    ];
    const campers = [camper({ id: 10, lodging: 2 }), camper({ id: 11, lodging: 2 })];

    const tree = buildLodgingTree(lodgings, campers, '1');
    expect(tree).toBeDefined();
    expect(tree?.isLeaf).toBe(false);
    expect(tree?.count).toBe(2); // recursive occupancy
    expect(tree?.capacity).toBe(4); // root capacity 0 → summed from children
    expect(tree?.maxCapacity).toBe(4);

    const child = tree?.children[0];
    expect(child?.fullPath).toBe('Cabin A');
    expect(child?.campers.map((c) => c.id)).toEqual([10, 11]);

    const lookup = flattenLodgingTree(tree);
    expect(Object.keys(lookup).sort()).toEqual(['1', '2']);
  });

  it('returns undefined when there is no root lodging', () => {
    expect(buildLodgingTree([], [], '1')).toBeUndefined();
  });
});
