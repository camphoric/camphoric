import type { ApiCamper, AugmentedLodging, LodgingLookup } from 'api-types';
import { describe, expect, it } from 'vitest';

import { assignedLodgingPath } from '../lodgingPath';

const node = (id: number, fullPath: string, isLeaf: boolean) =>
  ({ id, fullPath, isLeaf }) as AugmentedLodging;

const lookup: LodgingLookup = {
  '1': node(1, 'Cabins', false),
  '2': node(2, 'Cabins→Cabin A', true),
};

const camper = (lodging: number | null) => ({ id: 9, lodging }) as ApiCamper;

describe('assignedLodgingPath', () => {
  it('shows the path of a leaf unit', () => {
    expect(assignedLodgingPath(camper(2), lookup)).toBe('Cabins→Cabin A');
  });

  it('reads Unassigned when the camper has no lodging', () => {
    expect(assignedLodgingPath(camper(null), lookup)).toBe('Unassigned');
  });

  it('reads Unassigned when the lodging is not a leaf', () => {
    expect(assignedLodgingPath(camper(1), lookup)).toBe('Unassigned');
  });

  it('reads Unassigned when the lodging is not in the lookup', () => {
    expect(assignedLodgingPath(camper(99), lookup)).toBe('Unassigned');
  });
});
