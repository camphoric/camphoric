/**
 * fuse utils
 *
 * We use the Fuse library to search on the front end.  These are utils to make
 * life easier when using a Fuse search index
 */
import Fuse from 'fuse.js';

export function docToSearchResult<P>(item: P, refIndex: number): Fuse.FuseResult<P> {
  return {
    item,
    matches: [],
    refIndex,
    score: 0,
  };
}

export function getFirstNOf<P>(index: Fuse<P>, count: number): Array<Fuse.FuseResult<P>> {
  // @ts-ignore
  const allDocs = index.getIndex().docs as Array<P>;

  return allDocs.slice(0, count).map(docToSearchResult);
}
