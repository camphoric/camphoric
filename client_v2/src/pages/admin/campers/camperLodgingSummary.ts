/**
 * What the camper editor's Lodging tab shows (SPEC §8.5): where the camper is
 * placed and for which days, the unit's notes, and who else is in that unit.
 * A camper counts as placed only in a leaf unit (as on the lodging screen,
 * §8.6), so one on a non-leaf node — where registration leaves the lodging
 * they asked for — reads as unassigned.
 */

import type { ApiCamper, LodgingLookup } from 'api-types';
import { byName, lodgingPathLabel } from 'pages/admin/lodging/timelineUtils';
import { camperName } from 'utils/camper';

export interface Roommate {
  id: number;
  name: string;
  /** The days they're present, sorted. */
  stay: string[];
}

export interface CamperLodgingSummary {
  /** The unit's path ("Camp 1 → Cabin → Cabin 05"), or null when the camper isn't placed. */
  path: string | null;
  /** The days they're present, sorted. */
  stay: string[];
  /** The organizers' notes on the unit. */
  notes: string;
  /** The other campers in the unit, by name. */
  others: Roommate[];
}

const sortedStay = (camper: ApiCamper): string[] => [...(camper.stay ?? [])].sort();

export function camperLodgingSummary(
  camper: ApiCamper,
  lodgingLookup: LodgingLookup,
): CamperLodgingSummary {
  const lodging = camper.lodging == null ? undefined : lodgingLookup[String(camper.lodging)];
  if (!lodging?.isLeaf) return { path: null, stay: [], notes: '', others: [] };

  return {
    path: lodgingPathLabel(lodging.pathParts),
    stay: sortedStay(camper),
    notes: lodging.notes.trim(),
    others: lodging.campers
      .filter((other) => other.id !== camper.id)
      .map((other) => ({ id: other.id, name: camperName(other), stay: sortedStay(other) }))
      .sort((a, b) => byName(a.name, b.name)),
  };
}
