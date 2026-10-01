import type { ApiCamper, AugmentedLodging, LodgingLookup } from 'api-types';
import { describe, expect, it } from 'vitest';

import { camperLodgingSummary } from '../camperLodgingSummary';

const camper = (id: number, first: string, lodging: number | null, stay: string[] | null) =>
  ({
    id,
    attributes: { first_name: first, last_name: 'Ross' },
    lodging,
    stay,
  }) as unknown as ApiCamper;

const BOB = camper(1, 'Bob', 10, ['2026-10-17', '2026-10-16']);
const JANE = camper(2, 'Jane', 10, ['2026-10-17']);
const ANNIE = camper(3, 'Annie', 10, null);
const RIVER = camper(4, 'River', 3, null);
const ANI = camper(5, 'Ani', null, null);

const lookup: LodgingLookup = {
  '3': { id: 3, isLeaf: false, pathParts: ['Camp 1', 'Cabins'], notes: '', campers: [RIVER] },
  '10': {
    id: 10,
    isLeaf: true,
    pathParts: ['Camp 1', 'Cabins', 'Cabin A'],
    notes: ' Broken ladder. ',
    campers: [BOB, JANE, ANNIE],
  },
} as unknown as Record<string, AugmentedLodging>;

describe('camperLodgingSummary', () => {
  it('gives the unit, the stay, its notes, and the others there by name', () => {
    expect(camperLodgingSummary(BOB, lookup)).toEqual({
      path: 'Camp 1 → Cabins → Cabin A',
      stay: ['2026-10-16', '2026-10-17'],
      notes: 'Broken ladder.',
      others: [
        { id: 3, name: 'Annie Ross', stay: [] },
        { id: 2, name: 'Jane Ross', stay: ['2026-10-17'] },
      ],
    });
  });

  it('has no one else for a camper alone in a unit', () => {
    const alone = { ...lookup, '10': { ...lookup['10'], campers: [BOB] } };
    expect(camperLodgingSummary(BOB, alone).others).toEqual([]);
  });

  it('reads a camper with no lodging as unassigned', () => {
    expect(camperLodgingSummary(ANI, lookup)).toEqual({
      path: null,
      stay: [],
      notes: '',
      others: [],
    });
  });

  it('reads a camper left on a non-leaf node as unassigned', () => {
    expect(camperLodgingSummary(RIVER, lookup).path).toBeNull();
  });
});
