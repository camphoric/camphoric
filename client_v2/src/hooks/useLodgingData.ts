/**
 * Lodging data for the admin lodging section (SPEC §8.6). Fetches the event's
 * lodging nodes and completed campers, builds the augmented tree (occupancy,
 * capacity, full paths), the flat lookup, the leaf list (campers attach only to
 * leaves), and the unassigned campers (no lodging yet).
 */

import type { ApiCamper, AugmentedLodging, LodgingLookup } from 'api-types';
import { useMemo } from 'react';
import { buildLodgingTree, flattenLodgingTree } from 'store/augmented';
import { camperHooks, lodgingHooks } from 'store/entities';

export interface LodgingData {
  tree?: AugmentedLodging;
  lodgingLookup: LodgingLookup;
  leaves: AugmentedLodging[];
  campers: ApiCamper[];
  unassigned: ApiCamper[];
}

export function useLodgingData(eventId: string): LodgingData | undefined {
  const { data: lodgings } = lodgingHooks.useList({ event: eventId });
  const { data: campers } = camperHooks.useList({
    registration__completed: 1,
    registration__event: eventId,
  });

  return useMemo(() => {
    if (!lodgings || !campers) return undefined;
    const tree = buildLodgingTree(lodgings, campers, eventId);
    const lodgingLookup = flattenLodgingTree(tree);
    const leaves = Object.values(lodgingLookup).filter((n) => n.isLeaf);
    const unassigned = campers.filter((c) => c.lodging == null);
    return { tree, lodgingLookup, leaves, campers, unassigned };
  }, [lodgings, campers, eventId]);
}
