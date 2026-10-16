import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ApiEditLease } from 'api-types';
import { createElement, type ReactNode } from 'react';
import { ApiError } from 'utils/fetch';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEditLease } from '../useEditLease';

const store = vi.hoisted(() => ({
  current: undefined as ApiEditLease | null | undefined,
  takeLease: vi.fn(),
  releaseLease: vi.fn(),
}));

vi.mock('store/leases', () => ({
  CLIENT_ID: 'my-tab',
  leaseKey: (model: string, id: unknown) => ['EditLease', model, String(id)],
  useRecordLease: () => ({ data: store.current }),
  takeLease: store.takeLease,
  releaseLease: store.releaseLease,
}));

const lease = (overrides: Partial<ApiEditLease> = {}): ApiEditLease => ({
  id: 5,
  model: 'camper',
  object_id: 1,
  event: 4,
  holder: { id: 9, name: 'Me' },
  client_id: 'my-tab',
  acquired_at: '2026-10-15T17:00:00Z',
  expires_at: '2026-10-15T17:01:30Z',
  ...overrides,
});
const alex = lease({ id: 6, holder: { id: 7, name: 'Alex' }, client_id: 'their-tab' });
let invalidate: ReturnType<typeof vi.spyOn>;
const held = (theirs: ApiEditLease) =>
  new ApiError(409, 'Conflict', { code: 'lease_held', lease: theirs });

function setup(isDirty = false) {
  const client = new QueryClient();
  invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(({ dirty }: { dirty: boolean }) => useEditLease('camper', 1, dirty), {
    initialProps: { dirty: isDirty },
    wrapper,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  store.current = null;
  store.takeLease.mockReset().mockResolvedValue(lease());
  store.releaseLease.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('useEditLease (SPEC §9.8, DR-110)', () => {
  it('holds the lease while there are unsaved changes, renewing it, then lets it go', async () => {
    const { rerender } = setup();
    expect(store.takeLease).not.toHaveBeenCalled();

    rerender({ dirty: true });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(store.takeLease).toHaveBeenCalledWith('camper', 1, false);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(store.takeLease).toHaveBeenCalledTimes(2);

    rerender({ dirty: false });
    expect(store.releaseLease).toHaveBeenCalledWith(5);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(store.takeLease).toHaveBeenCalledTimes(2);
  });

  it('lets it go when the form closes', async () => {
    const { unmount } = setup(true);
    await act(() => vi.advanceTimersByTimeAsync(0));
    unmount();
    expect(store.releaseLease).toHaveBeenCalledWith(5);
  });

  it('shows the record view-only while someone else edits, and can take it over', async () => {
    store.current = alex;
    const { result } = setup();
    expect(result.current.other).toBe(alex);
    expect(result.current.viewOnly).toBe(true);
    expect(store.takeLease).not.toHaveBeenCalled();

    await act(() => result.current.takeOver());
    expect(store.takeLease).toHaveBeenCalledWith('camper', 1, true);
  });

  it('stops renewing once someone else has it, and says so', async () => {
    store.takeLease.mockReset().mockRejectedValue(held(alex));
    const { result } = setup(true);
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.other).toEqual(alex);
    expect(result.current.overlapping).toBe(true);
    expect(result.current.viewOnly).toBe(false);

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(store.takeLease).toHaveBeenCalledTimes(1);
  });

  it('gives up a lease that comes back after the changes were dropped', async () => {
    let answer: (lease: ApiEditLease) => void = () => undefined;
    store.takeLease.mockReset().mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const { rerender } = setup(true);
    await act(() => vi.advanceTimersByTimeAsync(0));
    rerender({ dirty: false });
    await act(async () => {
      answer(lease());
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(store.releaseLease).toHaveBeenCalledWith(5);
  });

  it('keeps a lease it took over while the record stays open, unedited', async () => {
    store.current = alex;
    const { result } = setup();
    await act(() => result.current.takeOver());
    store.takeLease.mockClear();
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(store.takeLease).toHaveBeenCalledWith('camper', 1, false);
  });

  it('fetches the record afresh once their lease ends', () => {
    store.current = alex;
    const { rerender } = setup();
    store.current = null;
    rerender({ dirty: false });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['Camper'] });
  });

  it('isn’t shown its own lease as someone else’s', () => {
    store.current = lease();
    const { result } = setup();
    expect(result.current.other).toBeNull();
    expect(result.current.viewOnly).toBe(false);
  });
});
