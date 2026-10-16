/**
 * Edit leases (SPEC §5, §9.8; §15, DR-110): who is editing a record. This page
 * is named by `CLIENT_ID`, new each time it loads: a duplicated tab is another
 * editor, and a reloaded one gave up its leases as it closed.
 */

import { useQuery } from '@tanstack/react-query';
import type { ApiEditLease, Scalar } from 'api-types';
import { useLiveFeedState } from 'store/liveFeed';
import { getCsrfToken } from 'utils/csrf';
import { apiFetch } from 'utils/fetch';

export const LEASES = 'EditLease';

/**
 * How often a record's lease is looked at while it's open. While the event's
 * live change feed is open it says when a lease is taken or given up, so a
 * record nobody holds isn't looked at; one someone holds still is, since a
 * lease that simply lapses changes nothing to send a notice about (DR-112).
 */
const POLL_MS = 15_000;

export const CLIENT_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const leaseKey = (model: string, id: Scalar) => [LEASES, model, String(id)];

/** The event's leases: apart from every record's own (`leaseKey`), the event's included. */
export const EVENT_LEASES = '@event';
export const eventLeasesKey = (eventId: Scalar | undefined) => [
  LEASES,
  EVENT_LEASES,
  String(eventId),
];

/** The record's current lease, or null; looked at again every so often. */
export function useRecordLease(model: string | undefined, id: Scalar, enabled = true) {
  const live = useLiveFeedState() === 'live';
  return useQuery({
    queryKey: [LEASES, model, String(id)],
    queryFn: async ({ signal }) => {
      const leases = await apiFetch<ApiEditLease[]>(`/api/leases/?model=${model}&object_id=${id}`, {
        signal,
      });
      return leases[0] ?? null;
    },
    enabled: enabled && !!model,
    refetchInterval: (query) => (live && !query.state.data ? false : POLL_MS),
    staleTime: 0,
  });
}

/**
 * The event's leases that haven't lapsed, for marking what's being edited in
 * its lists. Looked at as `useRecordLease` is: every 15 seconds while any
 * lease is held or without the live feed.
 */
export function useEventLeases(eventId: Scalar | undefined) {
  const live = useLiveFeedState() === 'live';
  return useQuery({
    queryKey: eventLeasesKey(eventId),
    queryFn: ({ signal }) => apiFetch<ApiEditLease[]>(`/api/leases/?event=${eventId}`, { signal }),
    enabled: eventId !== undefined,
    refetchInterval: (query) => (live && !query.state.data?.length ? false : POLL_MS),
    staleTime: 0,
  });
}

/** Take or renew the record's lease for this tab; rejects with a 409 when another tab has it. */
export function takeLease(model: string, id: Scalar, takeover = false) {
  return apiFetch<ApiEditLease>('/api/leases/', {
    method: 'POST',
    body: { model, object_id: id, client_id: CLIENT_ID, takeover },
  });
}

/**
 * Give up a lease. `keepalive` lets it go out as the page is closed (unlike
 * `sendBeacon`, it can carry the CSRF header).
 */
export function releaseLease(leaseId: number, keepalive = false) {
  return fetch(`/api/leases/${leaseId}/?client_id=${encodeURIComponent(CLIENT_ID)}`, {
    method: 'DELETE',
    credentials: 'include',
    keepalive,
    headers: { 'X-CSRFToken': getCsrfToken() },
  }).catch(() => undefined);
}
