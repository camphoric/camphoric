import { LodgingLookup } from 'hooks/api';

export function getDaysArray(start: string, end: string): Array<Date> {
  let arr = [];

  for(
    let dt = new Date(start);
    dt <= new Date(end);
    dt.setDate(dt.getDate() + 1)
  ){
    arr.push(new Date(dt));
  }

  return arr;
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

