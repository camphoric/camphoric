import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ApiError } from 'utils/fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEntityHooks } from '../createEntityHooks';

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('utils/fetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/fetch')>()),
  apiFetch,
}));

interface Thing {
  id: number;
  name: string;
  version: number;
}

const things = createEntityHooks<Thing>({ name: 'Thing' });

function setup<T>(hook: () => T) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(hook, { wrapper });
  return { result, client };
}

beforeEach(() => {
  apiFetch.mockClear();
});

describe('createEntityHooks (SPEC §5, DR-109)', () => {
  it('sends the version an update was made from as If-Match, not in the body', async () => {
    apiFetch.mockResolvedValue({ id: 1, name: 'B', version: 4 });
    const { result } = setup(() => things.useUpdate());
    await act(() => result.current.mutateAsync({ id: 1, version: 3, name: 'B' }));
    expect(apiFetch).toHaveBeenCalledWith('/api/things/1/', {
      method: 'PATCH',
      body: { name: 'B' },
      headers: { 'If-Match': '"3"' },
    });
  });

  it('sends no If-Match without a version', async () => {
    apiFetch.mockResolvedValue({ id: 1, name: 'B', version: 4 });
    const { result } = setup(() => things.useUpdate());
    await act(() => result.current.mutateAsync({ id: 1, name: 'B' }));
    expect(apiFetch).toHaveBeenCalledWith('/api/things/1/', {
      method: 'PATCH',
      body: { name: 'B' },
      headers: undefined,
    });
  });

  it('sends the version with a delete', async () => {
    apiFetch.mockResolvedValue(null);
    const { result } = setup(() => things.useDelete());
    await act(() => result.current.mutateAsync({ id: 1, version: 3 }));
    expect(apiFetch).toHaveBeenCalledWith('/api/things/1/', {
      method: 'DELETE',
      headers: { 'If-Match': '"3"' },
    });
  });

  it('refetches the entity when someone else changed it first', async () => {
    const current = { id: 1, name: 'Theirs', version: 4 };
    const refused = new ApiError(412, 'Precondition Failed', { code: 'version_conflict', current });
    apiFetch.mockImplementation(() => Promise.reject(refused));
    const { result, client } = setup(() => things.useUpdate());
    const listKey = things.listKey();
    client.setQueryData(listKey, [{ id: 1, name: 'Old', version: 3 }]);
    await expect(result.current.mutateAsync({ id: 1, version: 3, name: 'Mine' })).rejects.toBe(
      refused,
    );
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
  });

  it('takes only the filters its list has (SPEC DR-136)', () => {
    const filtered = createEntityHooks<Thing, 'event' | 'completed'>({ name: 'Thing' });
    expect(filtered.listKey({ event: 4, completed: 1 })).toEqual([
      'Thing',
      'list',
      '/api/things/',
      '?completed=1&event=4',
    ]);
    // @ts-expect-error -- not one of its filters (tsc -b checks this)
    filtered.listKey({ evnt: 4 });
    // @ts-expect-error -- an entity that names no filters takes none
    things.listKey({ event: 4 });
  });
});
