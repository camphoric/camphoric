/**
 * The public event list (GET /api/eventlist) backing the splash (§4). Public
 * (no auth) — each entry carries the event name, its registration URL, and
 * whether registration is open.
 */

import { useQuery } from '@tanstack/react-query';
import type { ApiEventListItem } from 'api-types';
import { apiFetch } from 'utils/fetch';

export function usePublicEvents() {
  return useQuery({
    queryKey: ['publicEvents'],
    queryFn: () => apiFetch<ApiEventListItem[]>('/api/eventlist'),
    staleTime: 60_000,
  });
}
