import { describe, expect, it } from 'vitest';

import { chronologicalOrder, describeReasons, groupPeople, sharedEvents, unitKey } from '../people';
import { EVENTS, RECORDS } from './fixtures';

describe('chronologicalOrder', () => {
  it('puts events oldest first, by start then opening, undated last', () => {
    const undated = { ...EVENTS[0], event: 9, start: null, registration_start: null };
    const opened = { ...EVENTS[0], event: 8, start: null, registration_start: '2021-03-01T00:00Z' };
    const order = chronologicalOrder([...EVENTS, undated, opened]);
    expect([...order.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id)).toEqual([
      8, 5, 1, 2, 3, 4, 9,
    ]);
  });
});

describe('groupPeople', () => {
  const units = groupPeople(RECORDS, EVENTS);
  const byKey = new Map(units.map((u) => [u.key, u]));

  it('puts a person’s records together and each unlinked record alone', () => {
    expect(units).toHaveLength(7);
    const ann = byKey.get('person:7')!;
    expect(ann.records.map((r) => r.camper)).toEqual([11, 12, 13]);
    expect(byKey.get('camper:21')!.records.map((r) => r.camper)).toEqual([21]);
  });

  it('names a person by their newest record, and gathers their names and addresses', () => {
    const ann = byKey.get('person:7')!;
    expect(ann.name).toBe('Annie Lee');
    expect(ann.names).toEqual(['Ann Lee', 'Annie Lee']);
    expect(ann.emails).toEqual(['ann@example.com', 'lee@example.com']);
    expect(ann.age).toBe('50-64 years old');
    expect(ann.clashes).toEqual([]);
  });

  it('points out two records of one event', () => {
    const twin = { ...RECORDS[0], camper: 99 };
    const [ann] = groupPeople([...RECORDS.slice(0, 3), twin], EVENTS);
    expect(ann.clashes).toEqual([1]);
  });

  it('keys records by person, or by camper when linked to no one', () => {
    expect(unitKey(RECORDS[0])).toBe('person:7');
    expect(unitKey(RECORDS[3])).toBe('camper:21');
  });
});

describe('sharedEvents', () => {
  it('finds events more than one of the people were at', () => {
    const units = groupPeople(RECORDS, EVENTS);
    const byKey = new Map(units.map((u) => [u.key, u]));
    const ann = byKey.get('person:7')!;
    expect(sharedEvents([ann, byKey.get('camper:21')!])).toEqual([1]);
    expect(sharedEvents([ann, byKey.get('camper:22')!])).toEqual([]);
  });
});

describe('describeReasons', () => {
  it('says why records were suggested together', () => {
    expect(describeReasons(['same_name'])).toBe('Same name');
    expect(describeReasons(['nickname', 'same_last_name', 'same_email'])).toBe(
      'A nickname, same last name and an email in common',
    );
  });
});
