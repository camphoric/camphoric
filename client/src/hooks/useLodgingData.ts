/**
 * Lodging data for the admin lodging section (SPEC §8.6). Fetches the event's
 * lodging nodes and completed campers, builds the augmented tree (occupancy,
 * capacity, full paths), the flat lookup, the leaf list in tree order (campers
 * attach only to leaves), and the unassigned campers: those with no bar on the
 * timeline — not in a leaf unit, or in one with none of the event's `days` in
 * their stay. Registration sets a camper's `lodging` to the node they requested,
 * with no stay, so a non-null `lodging` doesn't mean they've been placed.
 */

import type { ApiCamper, AugmentedLodging, LodgingLookup } from 'api-types';
import { isUnassigned } from 'pages/admin/lodging/timelineUtils';
import { useMemo } from 'react';
import { buildLodgingTree, flattenLodgingTree, listLodgingTree } from 'store/augmented';
import { camperHooks, lodgingHooks } from 'store/entities';

export interface LodgingData {
  tree?: AugmentedLodging;
  lodgingLookup: LodgingLookup;
  leaves: AugmentedLodging[];
  campers: ApiCamper[];
  unassigned: ApiCamper[];
}

export function useLodgingData(eventId: string, days: string[]): LodgingData | undefined {
  const { data: lodgings } = lodgingHooks.useList({ event: eventId });
  const { data: campers } = camperHooks.useList({
    registration__completed: 1,
    registration__event: eventId,
  });

  return useMemo(() => {
    if (!lodgings || !campers) return undefined;
    const tree = buildLodgingTree(lodgings, campers, eventId);
    const lodgingLookup = flattenLodgingTree(tree);
    const leaves = listLodgingTree(tree).filter((n) => n.isLeaf);
    const unassigned = campers.filter((c) => isUnassigned(c, lodgingLookup, days));
    return { tree, lodgingLookup, leaves, campers, unassigned };
  }, [lodgings, campers, eventId, days]);
}
