/**
 * Small object helpers used by the templating helpers (SPEC §9.3). Replaces the
 * old client's `lodash/get` and `lodash/flattenDeep` (DR-22) — these are the
 * only two uses, both trivial.
 */

/**
 * Read a value at a dot-separated path, e.g. `getByPath(obj, 'attributes.name')`
 * or `getByPath(obj, 'campers.0.id')`. Returns `undefined` if any segment is
 * missing. Mirrors `lodash/get` for the simple dot/index paths the helpers use.
 */
export function getByPath(target: unknown, path: string): unknown {
  if (!path) return target;
  return path.split('.').reduce<unknown>((value, key) => {
    if (value === null || value === undefined) return undefined;
    return (value as Record<string, unknown>)[key];
  }, target);
}

/** Recursively flatten nested arrays into a single-level array. */
export function flattenDeep<T>(values: readonly unknown[]): T[] {
  return values.reduce<T[]>((acc, value) => {
    if (Array.isArray(value)) {
      acc.push(...flattenDeep<T>(value));
    } else {
      acc.push(value as T);
    }
    return acc;
  }, []);
}
