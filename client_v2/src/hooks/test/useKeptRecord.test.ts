import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useKeptRecord } from '../useKeptRecord';

const report = { id: 3, version: 1, title: 'Roster' };

function open(id: string | undefined, found: typeof report | undefined) {
  return renderHook(({ id, found }) => useKeptRecord(id, found), {
    initialProps: { id, found },
  });
}

describe('useKeptRecord (SPEC §9.8)', () => {
  it('is the list’s copy while it’s there', () => {
    const { result, rerender } = open('3', report);
    const newer = { ...report, version: 2, title: 'Cabins' };
    rerender({ id: '3', found: newer });
    expect(result.current).toEqual({ record: newer, deleted: false });
  });

  it('keeps the last copy, and says so, once someone else deletes it', () => {
    const { result, rerender } = open('3', report);
    rerender({ id: '3', found: undefined });
    expect(result.current).toEqual({ record: report, deleted: true });
  });

  it('forgets it once the editor closes, so one deleted while closed doesn’t reopen', () => {
    const { result, rerender } = open('3', report);
    rerender({ id: undefined, found: report });
    rerender({ id: undefined, found: undefined }); // closed, then deleted
    rerender({ id: '3', found: undefined }); // opened again from a link
    expect(result.current).toEqual({ record: undefined, deleted: false });
  });

  it('forgets it once another opens', () => {
    const { result, rerender } = open('3', report);
    rerender({ id: '4', found: undefined });
    rerender({ id: '3', found: undefined });
    expect(result.current).toEqual({ record: undefined, deleted: false });
  });

  it('has nothing for a record it never saw (a stale link)', () => {
    const { result } = open('9', undefined);
    expect(result.current).toEqual({ record: undefined, deleted: false });
  });
});
