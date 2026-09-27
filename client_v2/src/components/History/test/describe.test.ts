import type { ApiHistoryEntry } from 'api-types';
import { describe, expect, it } from 'vitest';

import {
  actionName,
  changedPaths,
  changeLines,
  groupByRequest,
  objectName,
  schemaTitles,
  show,
} from '../describe';
import { ENTRIES, LOOKUPS, TITLES } from './entries';

const [restored, deleted, edit, pricing, payment, created] = ENTRIES;

describe('describing entries', () => {
  it('names what it was about and what happened', () => {
    expect([objectName(edit), actionName(edit)]).toEqual(['Registration', 'Changed']);
    expect([objectName(deleted), actionName(deleted)]).toEqual(['Camper “Sam Alpha”', 'Deleted']);
    expect(actionName(restored)).toBe('Restored');
    expect(actionName(created)).toBe('Created');
  });

  it('lists only the attributes that changed, by their titles', () => {
    expect(changeLines(edit, { titles: TITLES, lookups: LOOKUPS })).toEqual([
      { field: 'Campership donation', from: '25', to: '50' },
      { field: 'Main address › City', from: 'Berkeley', to: 'Oakland' },
      { field: 'Registrant email', from: 'pat@example.com', to: 'pat.alpha@example.com' },
      { field: 'Registration type', from: 'none', to: 'Staff' },
    ]);
  });

  it('shows a price as its total', () => {
    expect(changeLines(pricing)).toEqual([{ field: 'Price', from: '$825.00', to: '$850.00' }]);
  });

  it('shows money as money and nothing as none', () => {
    expect(changeLines(payment)).toEqual([
      { field: 'Amount', from: '$100.00', to: '$120.00' },
      { field: 'Paid on', from: 'none', to: '2026-10-01' },
    ]);
  });

  it('has no field list for a create, delete or restore', () => {
    expect([changeLines(created), changeLines(deleted), changeLines(restored)]).toEqual([
      [],
      [],
      [],
    ]);
  });

  it('keeps one save’s entries together', () => {
    expect(groupByRequest(ENTRIES).map((group) => group.length)).toEqual([1, 1, 2, 1, 1]);
  });
});

it('names a price override and its fields', () => {
  const entry: ApiHistoryEntry = {
    ...ENTRIES[4],
    object: { type: 'pricingoverride', id: 2, label: 'Tuition for Pat Alpha: $450.00' },
    changes: { amount: ['500.00', '450.00'], reason: ['Kid', 'Instructor’s kid'] },
  };
  expect(objectName(entry)).toBe('Price override “Tuition for Pat Alpha: $450.00”');
  expect(changeLines(entry)).toEqual([
    { field: 'Amount', from: '$500.00', to: '$450.00' },
    { field: 'Reason', from: 'Kid', to: 'Instructor’s kid' },
  ]);
});

describe('changedPaths', () => {
  it('walks nested objects and compares lists whole', () => {
    expect(
      changedPaths(
        { a: 1, b: { c: 2, d: 3 }, stay: ['Fri'] },
        { a: 1, b: { c: 2, d: 4 }, stay: ['Fri', 'Sat'], e: true },
      ),
    ).toEqual([
      ['b.d', 3, 4],
      ['stay', ['Fri'], ['Fri', 'Sat']],
      ['e', undefined, true],
    ]);
  });
});

describe('show', () => {
  it('writes values for people', () => {
    expect(show(null)).toBe('none');
    expect(show('')).toBe('none');
    expect(show(true)).toBe('Yes');
    expect(show('False')).toBe('No');
    expect(show(['Fri', 'Sat'])).toBe('Fri, Sat');
    expect(show('7', { '7': 'Cabin A' })).toBe('Cabin A');
    expect(show('8', { '7': 'Cabin A' })).toBe('#8');
  });
});

describe('schemaTitles', () => {
  it('reads titles, following $refs to definitions', () => {
    expect(
      schemaTitles({
        definitions: {
          address: { type: 'object', properties: { city: { type: 'string', title: 'City' } } },
        },
        properties: {
          comments: { type: 'string', title: 'Comments' },
          address: { title: 'Main address', $ref: '#/definitions/address' },
        },
      }),
    ).toEqual({ comments: 'Comments', address: 'Main address', 'address.city': 'City' });
  });
});

// Keep the fixture honest: newest first.
it('the fixture is newest first', () => {
  const times = ENTRIES.map((e: ApiHistoryEntry) => e.timestamp);
  expect(times).toEqual([...times].sort().reverse());
});
