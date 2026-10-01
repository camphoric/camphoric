/**
 * A small lodging tree and campers for the lodging stories: "Camp 1" holds
 * "Cabins" (Cabin A, Cabin B) and "Tents" (Tent 1); "Off Site" is a top-level
 * unit with no sub-units. Some nodes carry organizers' notes, long and short.
 * Some siblings are out of name order, as they come from the API in id order.
 */

import type { ApiCamper, AugmentedLodging } from 'api-types';

export const DAYS = ['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'];

const lodging = (
  id: number,
  parent: number | null,
  pathParts: string[],
  capacity: number,
  children: AugmentedLodging[] = [],
  notes = '',
): AugmentedLodging =>
  ({
    id,
    parent,
    name: pathParts[pathParts.length - 1] ?? 'Lodging',
    fullPath: pathParts.join('→'),
    pathParts,
    capacity,
    maxCapacity: capacity,
    reserved: 0,
    sharing_multiplier: 1,
    children_title: children.length ? 'Choose one' : '',
    visible: true,
    availability: 'auto',
    notes,
    isLeaf: children.length === 0,
    children,
    campers: [],
    count: 0,
  }) as unknown as AugmentedLodging;

const CABIN_A = lodging(
  10,
  3,
  ['Camp 1', 'Cabins', 'Cabin A'],
  2,
  [],
  'The ladder to the top bunk is broken, so keep the lower bunks for younger campers.\nThe key is with the caretaker; the porch light stays on all night.',
);
const CABIN_B = lodging(11, 3, ['Camp 1', 'Cabins', 'Cabin B'], 2);
const TENT = lodging(12, 4, ['Camp 1', 'Tents', 'Tent 1'], 1, [], 'Near the creek.');
const OFF_SITE = lodging(13, 1, ['Off Site'], 10);
const CABINS = lodging(
  3,
  2,
  ['Camp 1', 'Cabins'],
  0,
  [CABIN_B, CABIN_A],
  'Unheated: remind campers to bring warm sleeping bags.',
);
const TENTS = lodging(4, 2, ['Camp 1', 'Tents'], 0, [TENT]);
const CAMP = lodging(2, 1, ['Camp 1'], 0, [CABINS, TENTS]);
const ROOT = lodging(1, null, [], 0, [OFF_SITE, CAMP]);

/** Every node under the root, in tree order (as the page offers them). */
export const FILTER_NODES = [CAMP, CABINS, CABIN_A, CABIN_B, TENTS, TENT, OFF_SITE];
export const LEAVES = FILTER_NODES.filter((n) => n.isLeaf);

const camper = (
  id: number,
  first: string,
  last: string,
  lodgingId: number | null,
  stay: string[] | null,
): ApiCamper =>
  ({
    id,
    attributes: { first_name: first, last_name: last },
    lodging: lodgingId,
    stay,
  }) as unknown as ApiCamper;

export const CAMPERS: ApiCamper[] = [
  camper(1, 'Bob', 'Ross', 10, [DAYS[0], DAYS[1], DAYS[2]]),
  camper(2, 'Jane', 'Ross', 10, [DAYS[1], DAYS[2]]),
  // The whole event: every day but the last, which is departure day.
  camper(3, 'Buffy', 'Summers', 11, [DAYS[0], DAYS[1], DAYS[2]]),
  camper(7, 'Kaylee', 'Frye', 13, [DAYS[0], DAYS[1]]),
  camper(4, 'Ani', 'Skywalker', null, null),
  camper(5, 'Malcolm', 'Reynolds', null, null),
  // Registration leaves a camper on the node they requested, often a branch: still unassigned.
  camper(6, 'River', 'Tam', 3, null),
];

/** The leaves with the given campers placed in them (counts included). */
export const leavesWith = (campers: ApiCamper[]): AugmentedLodging[] =>
  LEAVES.map((leaf) => {
    const assigned = campers.filter((c) => c.lodging === leaf.id);
    return { ...leaf, campers: assigned, count: assigned.length };
  });

/** The campers not placed in a leaf. */
export const unassignedIn = (campers: ApiCamper[]): ApiCamper[] =>
  campers.filter((c) => !LEAVES.some((leaf) => leaf.id === c.lodging));

/** The whole tree with the given campers placed, each node's count summing its units'. */
export function treeWith(campers: ApiCamper[], node: AugmentedLodging = ROOT): AugmentedLodging {
  if (node.isLeaf) {
    const assigned = campers.filter((c) => c.lodging === node.id);
    return { ...node, campers: assigned, count: assigned.length };
  }
  const children = node.children.map((child) => treeWith(campers, child));
  const sum = (key: 'count' | 'capacity') => children.reduce((total, c) => total + c[key], 0);
  return {
    ...node,
    children,
    count: sum('count'),
    // As the app's tree has them: 0 takes the units' sum; the max adds both.
    capacity: node.capacity || sum('capacity'),
    maxCapacity: node.capacity + sum('capacity'),
  };
}
