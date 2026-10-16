import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRecordLease } from '../leases';
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
