import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useHasChanged } from '../useHasChanged';

describe('useHasChanged', () => {
  // A true render is followed by a false one: the hook records what it saw.
  it('is true for the first render and one that sees a new value', () => {
    const seen: boolean[] = [];
    const { rerender } = renderHook(
      ({ value }: { value: unknown }) => {
        const changed = useHasChanged(value);
        seen.push(changed);
        return changed;
      },
      { initialProps: { value: 1 } },
    );
    expect(seen).toEqual([true, false]);

    seen.length = 0;
    rerender({ value: 1 });
    expect(seen).toEqual([false]);

    seen.length = 0;
    rerender({ value: 2 });
    expect(seen).toEqual([true, false]);
  });

  it('compares by identity', () => {
    const seen: boolean[] = [];
    const { rerender } = renderHook(
      ({ value }: { value: object }) => {
        seen.push(useHasChanged(value));
      },
      { initialProps: { value: { id: 1 } } },
    );
    seen.length = 0;
    rerender({ value: { id: 1 } });
    expect(seen).toEqual([true, false]);
  });
});
