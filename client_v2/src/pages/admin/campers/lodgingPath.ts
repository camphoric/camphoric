import type { ApiCamper, LodgingLookup } from 'api-types';

/**
 * The camper's assigned lodging, as its path. A camper counts as placed only in a leaf unit, so
 * one whose `lodging` is null or a non-leaf node reads "Unassigned" (as on the lodging screen,
 * SPEC §8.6).
 */
export function assignedLodgingPath(camper: ApiCamper, lodgingLookup: LodgingLookup): string {
  const lodging = camper.lodging == null ? undefined : lodgingLookup[String(camper.lodging)];
  return lodging?.isLeaf ? lodging.fullPath : 'Unassigned';
}
