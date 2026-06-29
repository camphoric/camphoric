import type { AugmentedLodging } from 'api-types';
import { describe, expect, it } from 'vitest';

import { leavesUnderBranch, stayDayIndices, stayFrom, staySpan } from './timelineUtils';

const DAYS = ['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'];

describe('stayDayIndices', () => {
  it('maps a stay to sorted day-column indices, ignoring out-of-range days', () => {
    expect(stayDayIndices(['2026-10-18', '2026-10-16', '2030-01-01'], DAYS)).toEqual([0, 2]);
  });
  it('returns [] for a null stay', () => {
    expect(stayDayIndices(null, DAYS)).toEqual([]);
  });
});

describe('staySpan', () => {
  it('returns the [start..end] span of a stay', () => {
    expect(staySpan(['2026-10-17', '2026-10-19'], DAYS)).toEqual({ start: 1, end: 3 });
  });
  it('returns null for an empty stay', () => {
    expect(staySpan([], DAYS)).toBeNull();
  });
});

describe('stayFrom', () => {
  it('builds a length-N stay from a start index', () => {
    expect(stayFrom(DAYS, 1, 2)).toEqual(['2026-10-17', '2026-10-18']);
  });
  it('clamps to the event end', () => {
    expect(stayFrom(DAYS, 3, 3)).toEqual(['2026-10-19']);
  });
  it('clamps the start index and keeps at least one day', () => {
    expect(stayFrom(DAYS, 99, 2)).toEqual(['2026-10-19']);
    expect(stayFrom(DAYS, 0, 0)).toEqual(['2026-10-16']);
  });
});

describe('leavesUnderBranch', () => {
  const leaf = (fullPath: string): AugmentedLodging => ({ fullPath } as AugmentedLodging);
  const leaves = [leaf('Camp→Cabins→A'), leaf('Camp→Cabins→B'), leaf('Camp→Tents→1')];

  it('returns all leaves when no branch is given', () => {
    expect(leavesUnderBranch(leaves, undefined)).toHaveLength(3);
  });
  it('filters to the branch subtree (and not prefix-collisions)', () => {
    const branch = { fullPath: 'Camp→Cabins' } as AugmentedLodging;
    expect(leavesUnderBranch(leaves, branch).map((l) => l.fullPath)).toEqual([
      'Camp→Cabins→A',
      'Camp→Cabins→B',
    ]);
  });
});
