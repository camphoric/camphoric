/**
 * Group email (SPEC §8.9; §15 DR-45): the fields recipients can be chosen by,
 * who an audience reaches (live, from unsaved fields), and the template
 * actions — duplicate, send (a batch), send a test — plus the event's batches
 * with cancel and retry, and adding an unsubscribed address (§15 DR-48).
 * Template CRUD is `emailTemplateHooks`; the unsubscribed list is
 * `emailUnsubscribeHooks`.
 */

import { useDebouncedValue } from '@mantine/hooks';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiEmailBatch,
  ApiEmailTemplate,
  ApiEmailUnsubscribe,
  AudienceResolution,
  EmailAudience,
  EmailRecipientField,
  EmailRecipientSource,
  EmailSendRequest,
  EmailTemplateTestRequest,
  EmailTemplateTestResponse,
} from 'api-types';
import { apiFetch } from 'utils/fetch';

import { BUSY_POLL_MS, IDLE_POLL_MS } from './email';

/** The fields `source`'s recipients can be chosen by (none for listed addresses). */
export function useRecipientFields(eventId: string | number, source: EmailRecipientSource) {
  return useQuery({
    queryKey: ['EmailRecipientFields', String(eventId), source],
    queryFn: ({ signal }) =>
      apiFetch<EmailRecipientField[]>(
        `/api/events/${eventId}/email/recipient-fields?source=${source}`,
        { signal },
      ),
    enabled: source !== 'manual',
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Who `audience` reaches, re-checked as it's edited (debounced). With a
 * template, each recipient says whether that template was already sent to them.
 */
export function useAudience(
  eventId: string | number,
  audience: EmailAudience | null,
  templateId?: number,
) {
  const [debounced] = useDebouncedValue(audience, 400);
  return useQuery({
    queryKey: ['EmailAudience', String(eventId), debounced, templateId ?? null],
    queryFn: ({ signal }) =>
      apiFetch<AudienceResolution>(`/api/events/${eventId}/email/recipients`, {
        method: 'POST',
        body: { ...debounced, ...(templateId ? { template: templateId } : {}) },
        signal,
      }),
    enabled: !!debounced,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

function useInvalidateEmail() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ['EmailTemplate'] });
    void client.invalidateQueries({ queryKey: ['EmailBatch'] });
    void client.invalidateQueries({ queryKey: ['EmailMessage'] });
    void client.invalidateQueries({ queryKey: ['EmailQueue'] });
    void client.invalidateQueries({ queryKey: ['EmailAudience'] });
  };
}

/** Copy a group email template (named "… (copy)"). */
export function useDuplicateTemplate() {
  const invalidate = useInvalidateEmail();
  return useMutation({
    mutationFn: (templateId: number) =>
      apiFetch<ApiEmailTemplate>(`/api/emailtemplates/${templateId}/duplicate/`, {
        method: 'POST',
      }),
    onSuccess: invalidate,
  });
}

/** Send a group email to the reviewed recipients — now, or at `send_at`. */
export function useSendTemplate() {
  const invalidate = useInvalidateEmail();
  return useMutation({
    mutationFn: ({ templateId, ...request }: EmailSendRequest & { templateId: number }) =>
      apiFetch<ApiEmailBatch>(`/api/emailtemplates/${templateId}/send/`, {
        method: 'POST',
        body: request,
      }),
    onSuccess: invalidate,
  });
}

/** Queue one copy, marked [Test], rendered for a recipient, to `to` (default: you). */
export function useTestTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, ...request }: EmailTemplateTestRequest & { templateId: number }) =>
      apiFetch<EmailTemplateTestResponse>(`/api/emailtemplates/${templateId}/test/`, {
        method: 'POST',
        body: request,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['EmailMessage'] });
      void client.invalidateQueries({ queryKey: ['EmailQueue'] });
    },
  });
}

/** Whether a batch still has work to do (so it's worth re-reading soon). */
export function batchActive(batch: ApiEmailBatch) {
  return batch.state === 'preparing' || batch.state === 'sending';
}

/** The event's group email sends, newest first, re-read faster while one is going out. */
export function useEmailBatches(eventId: string | number) {
  return useQuery({
    queryKey: ['EmailBatch', 'list', String(eventId)],
    queryFn: ({ signal }) =>
      apiFetch<ApiEmailBatch[]>(`/api/emailbatches/?event=${eventId}`, { signal }),
    refetchInterval: (query) => (query.state.data?.some(batchActive) ? BUSY_POLL_MS : IDLE_POLL_MS),
  });
}

function useBatchAction<T>(action: 'cancel' | 'retry-failed') {
  const invalidate = useInvalidateEmail();
  return useMutation({
    mutationFn: (batchId: number) =>
      apiFetch<T>(`/api/emailbatches/${batchId}/${action}/`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

/** Stop a batch: before it's prepared, or its copies still waiting. */
export const useCancelBatch = () => useBatchAction<ApiEmailBatch>('cancel');

/** Queue a batch's failed copies again. */
export const useRetryBatch = () =>
  useBatchAction<ApiEmailBatch & { retried: number }>('retry-failed');

/** Unsubscribe an address from the event's group email, as an organizer. */
export function useAddUnsubscribe() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, email }: { eventId: number; email: string }) =>
      apiFetch<ApiEmailUnsubscribe>('/api/emailunsubscribes/', {
        method: 'POST',
        body: { event: eventId, email },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['EmailUnsubscribe'] });
      void client.invalidateQueries({ queryKey: ['EmailAudience'] });
    },
  });
}
