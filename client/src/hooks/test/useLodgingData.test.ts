import { renderHook } from '@testing-library/react';
import type { ApiCamper, ApiLodging } from 'api-types';
import { describe, expect, it, vi } from 'vitest';

import { useLodgingData } from '../useLodgingData';

const DAYS = ['2026-10-16', '2026-10-17', '2026-10-18'];

const lodging = (id: number, parent: number | null, name: string) =>
  ({ id, event: 7, parent, name, capacity: 0 }) as unknown as ApiLodging;

// "Let registrar assign" is a leaf, as Lark's registration form offers it.
const LODGINGS = [
  lodging(1, null, 'Lark'),
  lodging(2, 1, 'Cabins'),
  lodging(3, 2, 'Cabin A'),
  lodging(4, 1, 'Let registrar assign'),
];

const camper = (id: number, lodging: number | null, stay: string[] | null) =>
  ({ id, lodging, stay }) as unknown as ApiCamper;

const PLACED = camper(1, 3, [DAYS[0], DAYS[1]]);
const NONE = camper(2, null, null);
const ON_BRANCH = camper(3, 2, null);
const NO_STAY = camper(4, 4, null);
const EMPTY_STAY = camper(5, 4, []);
const STAY_OUTSIDE = camper(6, 3, ['2026-09-01']);
const CAMPERS = [PLACED, NONE, ON_BRANCH, NO_STAY, EMPTY_STAY, STAY_OUTSIDE];

vi.mock('store/entities', () => ({
  lodgingHooks: { useList: () => ({ data: LODGINGS }) },
  camperHooks: { useList: () => ({ data: CAMPERS }) },
}));

describe('useLodgingData', () => {
  it('lists as unassigned every camper with no days placed in a leaf unit', () => {
    const { result } = renderHook(() => useLodgingData('7', DAYS));
    expect(result.current?.unassigned).toEqual([
      NONE,
      ON_BRANCH,
      NO_STAY,
      EMPTY_STAY,
      STAY_OUTSIDE,
    ]);
  });

  it('still counts an unassigned camper toward the leaf they’re in', () => {
    const { result } = renderHook(() => useLodgingData('7', DAYS));
    const lookup = result.current!.lodgingLookup;
    expect(lookup['4'].campers).toEqual([NO_STAY, EMPTY_STAY]);
    expect(lookup['4'].count).toBe(2);
    expect(lookup['3'].count).toBe(2);
  });
});
