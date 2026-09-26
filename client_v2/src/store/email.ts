/**
 * The email outbox (SPEC §8.9; §15 DR-44): the event's email history (paged
 * and filtered on the server), one message with its content, what the queue is
 * doing now, and retrying or cancelling a message. Everything re-reads every
 * few seconds, faster while mail is waiting to go out.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiEmailMessage, EmailQueueState, Paginated } from 'api-types';
import { apiFetch } from 'utils/fetch';

/** How often the queue and history refresh while mail is waiting, and otherwise. */
export const BUSY_POLL_MS = 2000;
export const IDLE_POLL_MS = 5000;

export interface EmailHistoryFilters {
  /** Comma-separated statuses (`status__in`); empty: all. */
  status?: string;
  /** Comma-separated kinds (`kind__in`); empty: all. */
  kind?: string;
  q?: string;
  /** 1-based. */
  page?: number;
}

function historyQuery(eventId: string | number, filters: EmailHistoryFilters) {
  const params = new URLSearchParams({ event: String(eventId) });
  if (filters.status) params.set('status__in', filters.status);
  if (filters.kind) params.set('kind__in', filters.kind);
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));
  return params.toString();
}

export function pollInterval(state: EmailQueueState | undefined) {
  return state && state.queued + state.sending > 0 ? BUSY_POLL_MS : IDLE_POLL_MS;
}

/** What the event's email is doing now. */
export function useEmailQueue(eventId: string | number) {
  return useQuery({
    queryKey: ['EmailQueue', String(eventId)],
    queryFn: ({ signal }) =>
      apiFetch<EmailQueueState>(`/api/events/${eventId}/email/queue`, { signal }),
    refetchInterval: (query) => pollInterval(query.state.data),
  });
}

/** A page of the event's email history, newest first. */
export function useEmailHistory(
  eventId: string | number,
  filters: EmailHistoryFilters,
  refetchInterval: number,
) {
  const query = historyQuery(eventId, filters);
  return useQuery({
    queryKey: ['EmailMessage', 'list', query],
    queryFn: ({ signal }) =>
      apiFetch<Paginated<ApiEmailMessage>>(`/api/emailmessages/?${query}`, { signal }),
    placeholderData: keepPreviousData,
    refetchInterval,
  });
}

/** One message, with the content that was sent. */
export function useEmailMessage(messageId: number | undefined, refetchInterval: number | false) {
  return useQuery({
    queryKey: ['EmailMessage', 'detail', messageId],
    queryFn: ({ signal }) =>
      apiFetch<ApiEmailMessage>(`/api/emailmessages/${messageId}/`, { signal }),
    enabled: messageId !== undefined,
    refetchInterval,
  });
}

function useMessageAction(action: 'retry' | 'cancel') {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (messageId: number) =>
      apiFetch<ApiEmailMessage>(`/api/emailmessages/${messageId}/${action}/`, { method: 'POST' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['EmailMessage'] });
      void client.invalidateQueries({ queryKey: ['EmailQueue'] });
      // An invitation shows its latest email's status.
      void client.invalidateQueries({ queryKey: ['Invitation'] });
    },
  });
}

/** Queue a failed message again. */
export const useRetryEmail = () => useMessageAction('retry');

/** Stop a queued message from being sent. */
export const useCancelEmail = () => useMessageAction('cancel');

/** Queue a test message through an email account, to `to` (default: you). */
export function useTestEmailAccount() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, to }: { accountId: number; to?: string }) =>
      apiFetch<ApiEmailMessage>(`/api/emailaccounts/${accountId}/test/`, {
        method: 'POST',
        body: to ? { to } : {},
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['EmailMessage'] }),
  });
}
