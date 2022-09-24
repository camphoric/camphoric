import { LodgingLookup } from 'hooks/api';
import flattenDeep from 'lodash/flattenDeep';

export function getDaysArray(event?: ApiEvent): Array<Date> {
  let arr: Array<Date> = [];

  if (!event) return arr;
  if (!event.start || !event.end) return arr;

  for(
    let dt = new Date(event.start);
    dt <= new Date(event.end);
    dt.setDate(dt.getDate() + 1)
  ){
    arr.push(new Date(dt));
  }

  return arr;
};

export function lodgingIsAncestorOf(
  leaf: AugmentedLodging,
  targetId: number | string,
  lookup: LodgingLookup,
) {
  const findInParent = (id?: string | number): boolean => {
    if (!id) return false;

    const node = lookup[id];

    if (node.id.toString() === targetId.toString()) return true;

    return findInParent(node.parent);
  };

  return findInParent(leaf.id);
}

export function getNonLeafNodes(
  lodgingTree: AugmentedLodging,
  nonLeaves: Array<AugmentedLodging> = [],
): Array<AugmentedLodging> {
  if (lodgingTree.isLeaf) return nonLeaves;

  nonLeaves.push(lodgingTree);

  lodgingTree.children.forEach(
    (l) => getNonLeafNodes(l, nonLeaves)
  );

  return nonLeaves.slice(1);
};


export function getLeafNodes(
  lodgingTree: AugmentedLodging,
  leaves: LodgingLookup = {},
  titles: Array<string> = []
): LodgingLookup {
  if (lodgingTree.isLeaf) {
    leaves[[
      ...titles,
      lodgingTree.name,
    ].join('->')] = lodgingTree;
    return leaves;
  }

  let newTitles = titles;
  if (Object.values(leaves).length) {
    newTitles = [...titles, lodgingTree.name || '?'];
  }

  lodgingTree.children.forEach(
    (l) => getLeafNodes(l, leaves, newTitles)
  );

  return leaves;
};

export type LodgingPair = [a: string, b: AugmentedLodging];

export const sortLodgingNames = (a: LodgingPair, b: LodgingPair) => {
  const nameA = a[0];
  const nameB = b[0];
  if (nameA < nameB) {
    return -1;
  }
  if (nameA > nameB) {
    return 1;
  }

  // names must be equal
  return 0;
};

export const getAllParentClasses = (target: HTMLDivElement | null): Array<string> => {
  if (!target) return [];

  return flattenDeep([
    ...Array.from(target.classList || []),
    ...getAllParentClasses(target.parentNode as HTMLDivElement),
  ])
};

