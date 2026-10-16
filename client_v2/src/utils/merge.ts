/**
 * Comparing and merging edits to a record (SPEC §9.8 Concurrent editing,
 * DR-109). Values are JSON: plain objects are compared and merged key by key —
 * so a registration's `attributes` merge question by question — while arrays
 * and other values are taken whole.
 */

type Json = unknown;
type JsonObject = Record<string, Json>;

export function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Whether two JSON values are the same (key order doesn't matter). */
export function isEqual(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => isEqual(item, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => isEqual(a[key], b[key]));
  }
  return false;
}

/** The top-level fields of `edited` that differ from `original`. */
export function changedFields<F extends object>(original: F, edited: F): Partial<F> {
  const changes: Partial<F> = {};
  for (const key of Object.keys(edited) as (keyof F)[]) {
    if (!isEqual(original[key], edited[key])) changes[key] = edited[key];
  }
  return changes;
}

/**
 * The dotted paths at which `b` differs from `a`, down into plain objects
 * (`attributes.first_name`).
 */
export function changedPaths(a: Json, b: Json, prefix = ''): string[] {
  if (isEqual(a, b)) return [];
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    return keys.flatMap((key) => changedPaths(a[key], b[key], prefix ? `${prefix}.${key}` : key));
  }
  return [prefix];
}

export interface Merge<F> {
  /** Their changes, plus mine; where we both changed something, mine. */
  merged: F;
  /** Dotted paths that both changed, differently. */
  conflicts: string[];
}

/**
 * Put my edits (`mine`, made from `base`) on top of the record as someone else
 * saved it since (`theirs`): what only they changed keeps their value, what
 * only I changed keeps mine, and where we both changed the same thing mine
 * wins and the path is listed in `conflicts`.
 */
export function threeWayMerge<F extends object>(base: F, mine: F, theirs: F): Merge<F> {
  const conflicts: string[] = [];
  const merged = mergeValue(base, mine, theirs, '', conflicts) as F;
  return { merged, conflicts };
}

function mergeValue(base: Json, mine: Json, theirs: Json, path: string, conflicts: string[]): Json {
  if (isEqual(mine, base)) return theirs;
  if (isEqual(theirs, base) || isEqual(mine, theirs)) return mine;
  if (isPlainObject(mine) && isPlainObject(theirs)) {
    const before = isPlainObject(base) ? base : {};
    const result: JsonObject = {};
    const keys = new Set([...Object.keys(before), ...Object.keys(mine), ...Object.keys(theirs)]);
    for (const key of keys) {
      const value = mergeValue(
        before[key],
        mine[key],
        theirs[key],
        path ? `${path}.${key}` : key,
        conflicts,
      );
      // A key either side removed (and the other didn't change) stays removed.
      if (value !== undefined) result[key] = value;
    }
    return result;
  }
  conflicts.push(path);
  return mine;
}
