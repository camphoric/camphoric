import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCheckPayPalOrder } from '../invoices';

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('utils/fetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/fetch')>()),
  apiFetch,
}));

beforeEach(() => {
  apiFetch.mockReset();
});

describe('useCheckPayPalOrder', () => {
  it('refreshes the invoices even when PayPal no longer knows the order', async () => {
    // The server answers `mismatch` but releases a held invoice (DR-133): the
    // card must show it.
    apiFetch.mockRejectedValue(new Error('PayPal doesn’t know that order.'));
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useCheckPayPalOrder(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(5).catch(() => undefined);
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['Invoice'] });
  });
});
