/**
 * Bulk email (SPEC §8.9): who a recipient list reaches (live, from unsaved
 * criteria), a task and its recipients polled while it sends, and the send,
 * cancel, test and resolve actions. Task CRUD is `bulkEmailTaskHooks`.
 */

import { useDebouncedValue } from '@mantine/hooks';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiBulkEmailRecipient,
  ApiBulkEmailTask,
  BulkEmailTestResponse,
  BulkRecipientCriteria,
  BulkRecipientResolution,
} from 'api-types';
import { apiFetch } from 'utils/fetch';

/** How often a sending task and its recipients are re-read. */
export const SENDING_POLL_MS = 2000;

/** Who `criteria` reaches, re-checked as they're edited (debounced). */
export function useRecipientPreview(
  eventId: string | number,
  criteria: BulkRecipientCriteria | null,
) {
  const [debounced] = useDebouncedValue(criteria, 500);
  return useQuery({
    queryKey: ['BulkRecipientPreview', String(eventId), debounced],
    queryFn: ({ signal }) =>
      apiFetch<BulkRecipientResolution>(`/api/events/${eventId}/bulkemail/recipients`, {
        method: 'POST',
        body: debounced,
        signal,
      }),
    enabled: !!debounced,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** A task, re-read every couple of seconds while it's sending. */
export function useBulkEmailTask(taskId: number | undefined) {
  return useQuery({
    queryKey: ['BulkEmailTask', 'detail', taskId],
    queryFn: ({ signal }) =>
      apiFetch<ApiBulkEmailTask>(`/api/bulkemailtasks/${taskId}/`, { signal }),
    enabled: taskId !== undefined,
    refetchInterval: (query) => (query.state.data?.status === 'running' ? SENDING_POLL_MS : false),
  });
}

/** A task's recipients (sent time, error), re-read while it's sending. */
export function useBulkEmailRecipients(taskId: number | undefined, sending: boolean) {
  return useQuery({
    queryKey: ['BulkEmailRecipient', 'list', taskId],
    queryFn: ({ signal }) =>
      apiFetch<ApiBulkEmailRecipient[]>(`/api/bulkemailrecipients/?task=${taskId}`, { signal }),
    enabled: taskId !== undefined,
    refetchInterval: sending ? SENDING_POLL_MS : false,
  });
}

function useInvalidateBulkEmail() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ['BulkEmailTask'] });
    void client.invalidateQueries({ queryKey: ['BulkEmailRecipient'] });
  };
}

/** The task's list as it would be built now, without saving it (for the send confirmation). */
export function useResolveDryRun() {
  return useMutation({
    mutationFn: (taskId: number) =>
      apiFetch<BulkRecipientResolution>(`/api/bulkemailtasks/${taskId}/recipients/resolve`, {
        method: 'POST',
        body: { dry_run: true },
      }),
  });
}

/** Start (or resume) sending in the background; returns at once (202). */
export function useSendBulkEmail() {
  const invalidate = useInvalidateBulkEmail();
  return useMutation({
    mutationFn: (taskId: number) =>
      apiFetch<ApiBulkEmailTask>(`/api/bulkemailtasks/${taskId}/send?background=1`, {
        method: 'POST',
      }),
    onSuccess: invalidate,
  });
}

export function useCancelBulkEmail() {
  const invalidate = useInvalidateBulkEmail();
  return useMutation({
    mutationFn: (taskId: number) =>
      apiFetch<{ success: boolean }>(`/api/bulkemailtasks/${taskId}/cancel`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

/** Send one copy, rendered for the first recipient, to `to` (default: you). */
export function useTestBulkEmail() {
  return useMutation({
    mutationFn: ({ taskId, to }: { taskId: number; to?: string }) =>
      apiFetch<BulkEmailTestResponse>(`/api/bulkemailtasks/${taskId}/test`, {
        method: 'POST',
        body: to ? { to } : {},
      }),
  });
}
