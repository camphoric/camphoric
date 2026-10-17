import type { ApiCamper, LodgingLookup } from 'api-types';

/**
 * The camper's assigned lodging, as its path. A camper counts as placed only in a leaf unit, so
 * one whose `lodging` is null or a non-leaf node reads "Unassigned" (SPEC §8.5). One in a leaf
 * reads as that leaf even with no days in their stay: the lodging screen lists them as unassigned
 * until they're given days (§8.6), but the unit they're in still shows here.
 */
export function assignedLodgingPath(camper: ApiCamper, lodgingLookup: LodgingLookup): string {
  const lodging = camper.lodging == null ? undefined : lodgingLookup[String(camper.lodging)];
  return lodging?.isLeaf ? lodging.fullPath : 'Unassigned';
}
