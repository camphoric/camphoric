/**
 * Comparison helpers used by the templating sort helpers (eachsort/eachrsort/
 * eachLookupSort — SPEC §9.3). Numbers sort numerically; everything else sorts
 * as accent-insensitive strings (a natural, locale-aware ordering for names).
 */

export function sortStringCompare(a: unknown, b: unknown): number {
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'accent' });
}

export function sortComparison(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return sortStringCompare(a, b);
}
