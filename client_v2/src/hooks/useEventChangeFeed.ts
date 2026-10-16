/**
 * The open event's live change feed (SPEC §5, §9.8; §15, DR-112). The server
 * says what changed — a record's kind and id, never its contents — and this
 * refetches it through the API as usual: each notice marks its entity's
 * queries stale, with what that entity's changes change too (a payment, its
 * registration's balance and invoice: store/entities ALSO_CHANGES) and change
 * histories and deleted lists, gathering a quarter-second's notices at a time.
 * A lease notice refreshes that record's lease. Each hello — the stream's
 * first included, since the page's own fetches raced it — and being told to
 * resync refetch everything, since notices may have been missed meanwhile.
 *
 * The server pings every 20 seconds; hearing nothing for STALE_MS means the
 * stream died without saying so (a proxy or NAT dropped it, a laptop slept), so
 * it's opened afresh. A stream the browser gave up on (an error answer — a
 * proxy's during a deploy, or a server that won't stream) is tried again every
 * RETRY_MS. A tab hidden for HIDDEN_MS closes its stream — browsers give a site
 * only a few connections, and every open stream holds one — and reopens it,
 * refetching everything, when it's shown again. Unsaved edits are safe: an
 * edit form keeps them through a refetch (hooks/useEditableRecord).
 */

import { useQueryClient } from '@tanstack/react-query';
import type { Scalar } from 'api-types';
import { useEffect, useState } from 'react';
import { ALSO_CHANGES } from 'store/entities';
import { EVENT_LEASES, leaseKey, LEASES } from 'store/leases';
import type { LiveFeedState } from 'store/liveFeed';
import { ENTITY_OF_MODEL } from 'store/liveModels';

const GATHER_MS = 250;
const STALE_MS = 50_000;
const RETRY_MS = 30_000;
const HIDDEN_MS = 60_000;
const WATCH_MS = 10_000;
// Changing an entity also changes its history, and a delete a deleted list.
const ALWAYS = ['History', 'Deleted'];

interface Notice {
  model: string;
  id: number;
}

export function useEventChangeFeed(eventId: Scalar | undefined): LiveFeedState {
  const client = useQueryClient();
  const [state, setState] = useState<LiveFeedState>(eventId ? 'connecting' : 'off');

  useEffect(() => {
    if (!eventId || typeof EventSource === 'undefined') {
      setState('off');
      return;
    }
    setState('connecting');
    const stale = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastHeard = Date.now();
    let lastOpened = Date.now();
    const heard = () => {
      lastHeard = Date.now();
    };

    const refetch = (names: string[]) => {
      names.forEach((name) => stale.add(name));
      if (timer !== undefined) return; // this window's refetch is already coming
      timer = setTimeout(() => {
        timer = undefined;
        [...stale, ...ALWAYS].forEach((name) => {
          void client.invalidateQueries({ queryKey: [name] });
        });
        stale.clear();
      }, GATHER_MS);
    };
    const everything = () => {
      const entities = Object.values(ENTITY_OF_MODEL);
      refetch([...entities, ...entities.flatMap((name) => ALSO_CHANGES[name] ?? []), LEASES]);
    };
    // Whether it has been live since the page opened: a drop after that is
    // reconnecting, a refusal before it is off.
    let everLive = false;
    const read = (event: Event) => JSON.parse((event as MessageEvent<string>).data) as Notice;

    const open = () => {
      lastOpened = Date.now();
      const source = new EventSource(`/api/events/${eventId}/stream/`, { withCredentials: true });
      source.addEventListener('hello', () => {
        heard();
        everything();
        everLive = true;
        setState('live');
      });
      // The server's routine 30-minute close: reopen at once, still live.
      source.addEventListener('bye', () => {
        source.close();
        heard();
        current = open();
      });
      source.addEventListener('ping', heard);
      source.addEventListener('change', (event) => {
        heard();
        const entity = ENTITY_OF_MODEL[read(event).model];
        if (entity) refetch([entity, ...(ALSO_CHANGES[entity] ?? [])]);
      });
      source.addEventListener('lease', (event) => {
        heard();
        // That record's lease, and the event's (its lists mark what's being edited).
        const { model, id } = read(event);
        void client.invalidateQueries({ queryKey: leaseKey(model, id) });
        void client.invalidateQueries({ queryKey: [LEASES, EVENT_LEASES] });
      });
      source.addEventListener('resync', () => {
        heard();
        everything();
      });
      source.onerror = () => {
        // The browser tries again by itself unless the server refused outright;
        // either way, once it has been live, it's reconnecting (the watchdog
        // tries a refused one again).
        setState(everLive || source.readyState !== EventSource.CLOSED ? 'reconnecting' : 'off');
      };
      return source;
    };

    let current = open();
    let paused = false;
    let hiddenSince: number | undefined;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSince = Date.now();
      } else {
        hiddenSince = undefined;
        if (paused) {
          paused = false;
          setState('connecting');
          heard();
          current = open();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const watchdog = setInterval(() => {
      const now = Date.now();
      if (paused) return;
      if (hiddenSince !== undefined) {
        // Hidden: no use reviving it now; close it once it's been a while.
        if (now - hiddenSince >= HIDDEN_MS) {
          current.close();
          paused = true;
        }
        return;
      }
      const closed = current.readyState === EventSource.CLOSED;
      if (closed ? now - lastOpened < RETRY_MS : now - lastHeard < STALE_MS) return;
      current.close();
      if (!closed) setState('reconnecting');
      heard();
      current = open();
    }, WATCH_MS);

    return () => {
      current.close();
      clearInterval(watchdog);
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [eventId, client]);

  return state;
}
