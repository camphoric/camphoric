import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ApiCamper } from 'api-types';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useLodgingAssignment } from '../useLodgingAssignment';

/** Each PATCH waits until the test settles it. */
const saves = vi.hoisted(() => [] as (() => void)[]);

vi.mock('utils/fetch', () => ({
  apiFetch: () =>
    new Promise((resolve) => {
      saves.push(() => resolve({}));
    }),
}));

const camper = (id: number) => ({ id, attributes: {} }) as unknown as ApiCamper;

function setup() {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useLodgingAssignment(), { wrapper });
  return { result, invalidate };
}

describe('useLodgingAssignment', () => {
  it('refetches campers only once the last move in flight has saved', async () => {
    saves.length = 0;
    const { result, invalidate } = setup();

    act(() => {
      result.current.mutate({ camper: camper(1), lodging: 10, stay: ['2026-10-16'] });
      result.current.mutate({ camper: camper(1), lodging: 10, stay: ['2026-10-17'] });
    });
    await waitFor(() => expect(saves).toHaveLength(2));

    // The first save's refetch would bring back the stay the second hasn't saved yet.
    await act(() => Promise.resolve(saves[0]()));
    expect(invalidate).not.toHaveBeenCalled();

    await act(() => Promise.resolve(saves[1]()));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['Camper'] }));
  });
});
