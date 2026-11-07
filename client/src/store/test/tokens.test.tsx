import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ApiError } from 'utils/fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NOT_FOUND_FOR_ADMIN, useCreateToken, useRevokeToken } from '../tokens';

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('utils/fetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/fetch')>()),
  apiFetch,
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  apiFetch.mockReset();
});

describe('personal access token hooks (#965)', () => {
  it('makes a token for yourself, sending never as null', async () => {
    apiFetch.mockResolvedValue({ id: 3, token: 'cmph_x' });
    const { result } = renderHook(() => useCreateToken(), { wrapper });
    await act(() => result.current.mutateAsync({ name: 'Export', expires_at: null }));
    expect(apiFetch).toHaveBeenCalledWith('/api/user/tokens', {
      method: 'POST',
      body: { name: 'Export', expires_at: null },
    });
  });

  it('revokes yours, or — for an Admin — a user’s', async () => {
    apiFetch.mockResolvedValue(null);
    const { result } = renderHook(() => useRevokeToken(), { wrapper });
    await act(() => result.current.mutateAsync({ tokenId: 4 }));
    expect(apiFetch).toHaveBeenLastCalledWith('/api/user/tokens/4', { method: 'DELETE' });
    await act(() => result.current.mutateAsync({ tokenId: 4, userId: 2 }));
    expect(apiFetch).toHaveBeenLastCalledWith('/api/users/2/tokens/4/', { method: 'DELETE' });
  });

  it('says why an Admin’s revoke may have found nothing', async () => {
    apiFetch.mockRejectedValue(new ApiError(404, 'Not Found', { detail: 'Not found.' }));
    const { result } = renderHook(() => useRevokeToken(), { wrapper });
    const error: unknown = await result.current.mutateAsync({ tokenId: 4, userId: 2 }).then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).body).toEqual({ detail: NOT_FOUND_FOR_ADMIN });
  });
});
