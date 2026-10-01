import type { AugmentedLodging } from 'api-types';
import { describe, expect, it } from 'vitest';

import {
  areConsecutiveDays,
  dayLabel,
  leafSections,
  leavesUnder,
  lodgingFilterNodes,
  ownCapacity,
  stayableDays,
  stayDayIndices,
  stayFrom,
  staySpan,
  stayText,
  timelineDayUnits,
} from '../timelineUtils';

const DAYS = ['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'];

describe('dayLabel', () => {
  it('names the calendar day of a date-only value', () => {
    expect(dayLabel('2026-10-16')).toBe('Fri 10/16');
    expect(dayLabel('2026-10-16', 'EEE\nMM/dd')).toBe('Fri\n10/16');
  });
  it('passes through what it can\u2019t read', () => {
    expect(dayLabel('someday')).toBe('someday');
  });
});

describe('areConsecutiveDays', () => {
  it('is true for days with no gaps, across a month end and a DST change', () => {
    expect(areConsecutiveDays(['2026-10-31', '2026-11-01', '2026-11-02'])).toBe(true);
  });
  it('is false when a day is skipped', () => {
    expect(areConsecutiveDays(['2026-10-16', '2026-10-18'])).toBe(false);
  });
});

describe('stayDayIndices', () => {
  it('maps a stay to sorted day-column indices, ignoring out-of-range days', () => {
    expect(stayDayIndices(['2026-10-18', '2026-10-16', '2030-01-01'], DAYS)).toEqual([0, 2]);
  });
  it('returns [] for a null stay', () => {
    expect(stayDayIndices(null, DAYS)).toEqual([]);
  });
});

describe('staySpan', () => {
  it('returns the [start..end] span of a stay', () => {
    expect(staySpan(['2026-10-17', '2026-10-19'], DAYS)).toEqual({ start: 1, end: 3 });
  });
  it('returns null for an empty stay', () => {
    expect(staySpan([], DAYS)).toBeNull();
  });
});

describe('stayableDays', () => {
  it('leaves out the last day, which is departure day', () => {
    expect(stayableDays(DAYS)).toEqual(['2026-10-16', '2026-10-17', '2026-10-18']);
  });
  it('keeps a one-day event\u2019s only day', () => {
    expect(stayableDays(['2026-10-16'])).toEqual(['2026-10-16']);
  });
  it('bounds a stay seeded from the stayable days', () => {
    expect(stayFrom(stayableDays(DAYS), 2, 5)).toEqual(['2026-10-18']);
  });
});

describe('timelineDayUnits', () => {
  it('shows departure day as a half-day', () => {
    expect(timelineDayUnits(10)).toBe(9.5);
  });
  it('gives a one-day event its day and the half-day after', () => {
    expect(timelineDayUnits(1)).toBe(1.5);
  });
});

describe('stayFrom', () => {
  it('builds a length-N stay from a start index', () => {
    expect(stayFrom(DAYS, 1, 2)).toEqual(['2026-10-17', '2026-10-18']);
  });
  it('clamps to the event end', () => {
    expect(stayFrom(DAYS, 3, 3)).toEqual(['2026-10-19']);
  });
  it('clamps the start index and keeps at least one day', () => {
    expect(stayFrom(DAYS, 99, 2)).toEqual(['2026-10-19']);
    expect(stayFrom(DAYS, 0, 0)).toEqual(['2026-10-16']);
  });
});

/** A lodging node with the given children; leaves are the nodes without any. */
const node = (id: number, name: string, children: AugmentedLodging[] = []): AugmentedLodging =>
  ({ id, name, children, isLeaf: children.length === 0 }) as unknown as AugmentedLodging;

const cabinA = node(4, 'Cabin A');
const cabinB = node(5, 'Cabin B');
const tent = node(6, 'Tent 1');
const cabins = node(2, 'Cabins', [cabinA, cabinB]);
const tents = node(3, 'Tents', [tent]);
const offSite = node(7, 'Off Site');
const root = node(1, 'Lodging', [cabins, tents, offSite]);
const leaves = [cabinA, cabinB, tent, offSite];

describe('lodgingFilterNodes', () => {
  it('lists every node under the root, leaves included, in tree order', () => {
    expect(lodgingFilterNodes(root).map((n) => n.name)).toEqual([
      'Cabins',
      'Cabin A',
      'Cabin B',
      'Tents',
      'Tent 1',
      'Off Site',
    ]);
  });
  it('is empty without a tree', () => {
    expect(lodgingFilterNodes(undefined)).toEqual([]);
  });
});

describe('leavesUnder', () => {
  it('returns all leaves when nothing is chosen', () => {
    expect(leavesUnder(leaves, [])).toEqual(leaves);
  });
  it('returns the leaves under a branch', () => {
    expect(leavesUnder(leaves, [cabins])).toEqual([cabinA, cabinB]);
  });
  it('treats a chosen leaf as its own subtree', () => {
    expect(leavesUnder(leaves, [offSite])).toEqual([offSite]);
  });
  it('combines several choices in the leaves’ order, without duplicates', () => {
    expect(leavesUnder(leaves, [offSite, cabins, cabinA])).toEqual([cabinA, cabinB, offSite]);
  });
});

describe('stayText', () => {
  it('counts the days and spans consecutive ones', () => {
    expect(stayText(['2026-10-16', '2026-10-17', '2026-10-18'])).toBe(
      '3 days: Fri 10/16 – Sun 10/18',
    );
  });
  it('lists days that aren’t consecutive', () => {
    expect(stayText(['2026-10-16', '2026-10-18'])).toBe('2 days: Fri 10/16, Sun 10/18');
  });
  it('names a single day, or none', () => {
    expect(stayText(['2026-10-16'])).toBe('1 day: Fri 10/16');
    expect(stayText([])).toBe('No days set');
  });
});

describe('ownCapacity', () => {
  const node = (capacity: number, maxCapacity: number, children: number[] = []) =>
    ({
      capacity,
      maxCapacity,
      children: children.map((c) => ({ capacity: c })),
    }) as unknown as AugmentedLodging;

  it('is a unit’s capacity', () => {
    expect(ownCapacity(node(4, 4))).toBe(4);
  });
  it('is 0 for a node that takes its units’ sum', () => {
    expect(ownCapacity(node(6, 6, [2, 4]))).toBe(0);
  });
  it('is the capacity set on a node with units', () => {
    expect(ownCapacity(node(5, 11, [2, 4]))).toBe(5);
  });
});

describe('leafSections', () => {
  const unit = (id: number, parent: number, pathParts: string[]): AugmentedLodging =>
    ({
      id,
      parent,
      pathParts,
      name: pathParts[pathParts.length - 1],
    }) as unknown as AugmentedLodging;

  it('heads each group of siblings with its parent\u2019s path, sorted by that path', () => {
    const spot = unit(12, 3, ['Camp 1', 'Tent', 'Area A', 'Spot A01']);
    const cabin1 = unit(10, 2, ['Camp 1', 'Cabin', 'Cabin 01']);
    const offSite = unit(13, 1, ['Off Site']);
    const cabin2 = unit(11, 2, ['Camp 1', 'Cabin', 'Cabin 02']);
    expect(leafSections([spot, cabin1, offSite, cabin2])).toEqual([
      { heading: 'Camp 1 → Cabin', parentId: 2, leaves: [cabin1, cabin2] },
      { heading: 'Camp 1 → Tent → Area A', parentId: 3, leaves: [spot] },
      { heading: 'Top level', parentId: 1, leaves: [offSite] },
    ]);
  });
  it('sorts the units in a section by name, numbers numerically', () => {
    const cabin10 = unit(1, 2, ['Cabins', 'Cabin 10']);
    const cabin2 = unit(2, 2, ['Cabins', 'Cabin 2']);
    const annex = unit(3, 2, ['Cabins', 'annex']);
    expect(leafSections([cabin10, cabin2, annex])[0].leaves).toEqual([annex, cabin2, cabin10]);
  });
  it('is empty without leaves', () => {
    expect(leafSections([])).toEqual([]);
  });
});
