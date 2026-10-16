import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { useEventChangeFeed } from '../useEventChangeFeed';

/** Stands in for the browser's EventSource (jsdom has none). */
class FakeEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static last: FakeEventSource;
  readyState = FakeEventSource.CONNECTING;
  onerror: (() => void) | null = null;
  closed = false;
  listeners: Record<string, ((event: MessageEvent) => void)[]> = {};

  constructor(public url: string) {
    FakeEventSource.last = this;
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(listener);
  }

  emit(type: string, data: object = {}) {
    this.readyState = FakeEventSource.OPEN;
    this.listeners[type]?.forEach((listener) =>
      listener(new MessageEvent(type, { data: JSON.stringify(data) })),
    );
  }

  fail(readyState = FakeEventSource.CONNECTING) {
    this.readyState = readyState;
    this.onerror?.();
  }

  close() {
    this.closed = true;
  }
}

let invalidate: MockInstance<QueryClient['invalidateQueries']>;

function setup(eventId: string | null = '4') {
  const client = new QueryClient();
  invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(() => useEventChangeFeed(eventId ?? undefined), { wrapper });
}

const invalidated = () => invalidate.mock.calls.map(([filters]) => filters?.queryKey);

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('EventSource', FakeEventSource);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useEventChangeFeed (SPEC §9.8, DR-112)', () => {
  it('opens the event’s stream and is live once it says hello', () => {
    const { result } = setup();
    expect(FakeEventSource.last.url).toBe('/api/events/4/stream/');
    expect(result.current).toBe('connecting');
    act(() => FakeEventSource.last.emit('hello'));
    expect(result.current).toBe('live');
  });

  it('refetches what changed, a quarter-second’s worth at a time', () => {
    setup();
    act(() => FakeEventSource.last.emit('hello'));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    invalidate.mockClear();
    act(() => {
      FakeEventSource.last.emit('change', { model: 'camper', id: 1 });
      FakeEventSource.last.emit('change', { model: 'camper', id: 2 });
      FakeEventSource.last.emit('change', { model: 'registration', id: 9 });
    });
    expect(invalidate).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(invalidated()).toEqual([['Camper'], ['Registration'], ['History'], ['Deleted']]);
  });

  it('refetches what a change changes too: a payment, its registration and invoice', () => {
    setup();
    act(() => FakeEventSource.last.emit('change', { model: 'payment', id: 1 }));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(invalidated()).toEqual([
      ['Payment'],
      ['Registration'],
      ['Invoice'],
      ['History'],
      ['Deleted'],
    ]);
  });

  it('refetches every quarter-second through a steady run of changes', () => {
    setup();
    act(() => {
      for (let i = 0; i < 10; i++) {
        FakeEventSource.last.emit('change', { model: 'camper', id: i });
        vi.advanceTimersByTime(100);
      }
    });
    const camperRefetches = invalidated().filter((key) => key?.[0] === 'Camper');
    expect(camperRefetches.length).toBeGreaterThanOrEqual(3);
  });

  it('closes the stream in a tab hidden a while, and catches up when it’s shown', () => {
    const { result } = setup();
    const first = FakeEventSource.last;
    act(() => first.emit('hello'));
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(70_000);
    });
    expect(first.closed).toBe(true);
    expect(FakeEventSource.last).toBe(first);

    visibility.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(FakeEventSource.last).not.toBe(first);
    invalidate.mockClear();
    act(() => FakeEventSource.last.emit('hello'));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe('live');
    expect(invalidated()).toContainEqual(['Registration']);
    visibility.mockRestore();
  });

  it('refetches everything on its first hello: the page’s own fetches raced it', () => {
    setup();
    act(() => FakeEventSource.last.emit('hello'));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(invalidated()).toContainEqual(['Registration']);
    expect(invalidated()).toContainEqual(['Invitation']);
  });

  it('refreshes a record’s lease when it changes', () => {
    setup();
    act(() => FakeEventSource.last.emit('lease', { model: 'camper', id: 3 }));
    expect(invalidated()).toEqual([['EditLease', 'camper', '3']]);
  });

  it('refetches everything after a drop, or when told to resync', () => {
    const { result } = setup();
    act(() => FakeEventSource.last.emit('hello'));
    act(() => FakeEventSource.last.fail());
    expect(result.current).toBe('reconnecting');
    act(() => FakeEventSource.last.emit('hello'));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(invalidated()).toContainEqual(['Registration']);
    expect(invalidated()).toContainEqual(['EditLease']);

    invalidate.mockClear();
    act(() => FakeEventSource.last.emit('resync'));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(invalidated()).toContainEqual(['Camper']);
  });

  it('is off when the server won’t stream, tries again now and then, and closes with the event', () => {
    const { result, unmount } = setup();
    const refused = FakeEventSource.last;
    act(() => refused.fail(FakeEventSource.CLOSED));
    expect(result.current).toBe('off');
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(FakeEventSource.last).not.toBe(refused);
    expect(result.current).toBe('off');
    act(() => FakeEventSource.last.emit('hello'));
    expect(result.current).toBe('live');
    unmount();
    expect(FakeEventSource.last.closed).toBe(true);
  });

  it('opens a new stream when the old one has gone silent', () => {
    const { result } = setup();
    const first = FakeEventSource.last;
    act(() => first.emit('hello'));
    act(() => {
      vi.advanceTimersByTime(30_000);
      first.emit('ping');
      vi.advanceTimersByTime(30_000);
    });
    expect(FakeEventSource.last).toBe(first);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(first.closed).toBe(true);
    expect(FakeEventSource.last).not.toBe(first);
    expect(result.current).toBe('reconnecting');
    act(() => FakeEventSource.last.emit('hello'));
    expect(result.current).toBe('live');
  });

  it('is off without an event', () => {
    const { result } = setup(null);
    expect(result.current).toBe('off');
  });
});
