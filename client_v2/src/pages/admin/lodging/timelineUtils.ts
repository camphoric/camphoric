/**
 * Pure helpers for the lodging assignment timeline (SPEC §8.6). Stays are sets
 * of ISO day strings; the timeline lays them out as bars across the event's day
 * columns.
 */

import type { AugmentedLodging } from 'api-types';

/** The day-column indices a stay occupies, sorted ascending. */
export function stayDayIndices(stay: string[] | null | undefined, days: string[]): number[] {
  if (!stay) return [];
  return stay
    .map((d) => days.indexOf(d))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
}

/** The contiguous span [start..end] a stay occupies, or null when empty. */
export function staySpan(
  stay: string[] | null | undefined,
  days: string[],
): { start: number; end: number } | null {
  const indices = stayDayIndices(stay, days);
  if (indices.length === 0) return null;
  return { start: indices[0], end: indices[indices.length - 1] };
}

/**
 * A stay of `length` days starting at `startIndex`, clamped to the event's days.
 * `startIndex` is itself clamped so at least one day remains.
 */
export function stayFrom(days: string[], startIndex: number, length: number): string[] {
  const max = Math.max(0, days.length - 1);
  const start = Math.min(Math.max(0, startIndex), max);
  const len = Math.max(1, length);
  return days.slice(start, start + len);
}

/** The leaves under a branch node (the branch's whole subtree). */
export function leavesUnderBranch(
  leaves: AugmentedLodging[],
  branch: AugmentedLodging | undefined,
): AugmentedLodging[] {
  if (!branch) return leaves;
  const prefix = branch.fullPath;
  return leaves.filter((l) => l.fullPath === prefix || l.fullPath.startsWith(`${prefix}→`));
}
