import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEventLeases, useRecordLease } from '../leases';
import { LiveFeedContext, type LiveFeedState } from '../liveFeed';

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('utils/fetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/fetch')>()),
  apiFetch,
}));

const alex = { id: 6, holder: { id: 7, name: 'Alex' }, client_id: 'their-tab' };

function setup(feed: LiveFeedState) {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <LiveFeedContext.Provider value={feed}>{children}</LiveFeedContext.Provider>
    </QueryClientProvider>
  );
  return renderHook(() => useRecordLease('camper', 1), { wrapper });
}

async function after(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

beforeEach(() => {
  vi.useFakeTimers();
  apiFetch.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('useRecordLease (SPEC §9.8, DR-110, DR-112)', () => {
  it('doesn’t look again at a record nobody holds while the feed is live', async () => {
    apiFetch.mockResolvedValue([]);
    setup('live');
    await after(0);
    await after(60_000);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('keeps looking at one someone holds, since a lapse sends no notice', async () => {
    apiFetch.mockResolvedValue([alex]);
    setup('live');
    await after(0);
    await after(31_000);
    expect(apiFetch).toHaveBeenCalledTimes(3);
  });

  it('looks every 15 seconds without the feed', async () => {
    apiFetch.mockResolvedValue([]);
    setup('off');
    await after(0);
    await after(31_000);
    expect(apiFetch).toHaveBeenCalledTimes(3);
  });
});

describe('useEventLeases (lists’ markers)', () => {
  function setupEvent(feed: LiveFeedState) {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <LiveFeedContext.Provider value={feed}>{children}</LiveFeedContext.Provider>
      </QueryClientProvider>
    );
    return renderHook(() => useEventLeases(4), { wrapper });
  }

  it('asks for the event’s leases', async () => {
    apiFetch.mockResolvedValue([]);
    setupEvent('live');
    await after(0);
    expect(apiFetch).toHaveBeenCalledWith('/api/leases/?event=4', expect.anything());
  });

  it('keeps looking while any lease is held, since a lapse sends no notice', async () => {
    apiFetch.mockResolvedValue([alex]);
    setupEvent('live');
    await after(0);
    await after(31_000);
    expect(apiFetch).toHaveBeenCalledTimes(3);
  });

  it('doesn’t look again while none is, and the feed is live', async () => {
    apiFetch.mockResolvedValue([]);
    setupEvent('live');
    await after(0);
    await after(60_000);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});

describe('the event’s leases and the event’s own lease', () => {
  it('are kept apart, though both are the event’s', async () => {
    apiFetch.mockImplementation((url: string) =>
      Promise.resolve(url.includes('?event=') ? [alex, { ...alex, id: 8 }] : [alex]),
    );
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <LiveFeedContext.Provider value="live">{children}</LiveFeedContext.Provider>
      </QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({ all: useEventLeases(4), own: useRecordLease('event', 4) }),
      { wrapper },
    );
    await after(0);
    expect(result.current.all.data).toHaveLength(2);
    expect(result.current.own.data).toEqual(alex);
  });
});
