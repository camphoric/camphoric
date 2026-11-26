/**
 * An organization's email to past campers (SPEC §8.12; §15 DR-182): the fields
 * people can be chosen by, who the rules reach (live, from unsaved rules),
 * sending and testing an email, and the preview of one person's copy. The
 * emails and the unsubscribed addresses are entities (`organizationEmailHooks`,
 * `organizationUnsubscribeHooks`); sends are group email batches
 * (`useEmailBatches({ organization })`).
 */

import { useDebouncedValue } from '@mantine/hooks';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiEmailBatch,
  AudienceResolution,
  EmailFilter,
  EmailRecipientField,
  EmailSendRequest,
  EmailTemplateTestResponse,
  OrganizationEmailTestRequest,
  TemplateDescription,
  TemplatePreviewResponse,
} from 'api-types';
import { PREVIEW_DEBOUNCE_MS } from 'store/templates';
import { apiFetch } from 'utils/fetch';

const base = (organizationId: string | number) =>
  `/api/organizations/${organizationId}/multi-event`;

/** The fields people can be chosen by, for the rule builder. */
export function useOrganizationRecipientFields(organizationId: string | number) {
  return useQuery({
    queryKey: ['OrganizationRecipientFields', String(organizationId)],
    queryFn: ({ signal }) =>
      apiFetch<EmailRecipientField[]>(`${base(organizationId)}/email/recipient-fields`, {
        signal,
      }),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Who `filter` reaches, re-checked as it's edited (debounced). With an email,
 * each recipient says whether it was already sent to them.
 */
export function useOrganizationAudience(
  organizationId: string | number,
  filter: EmailFilter | null,
  emailId?: number,
) {
  const [debounced] = useDebouncedValue(filter, 400);
  return useQuery({
    queryKey: ['EmailAudience', 'organization', String(organizationId), debounced, emailId ?? null],
    queryFn: ({ signal }) =>
      apiFetch<AudienceResolution>(`${base(organizationId)}/email/recipients`, {
        method: 'POST',
        body: { filter: debounced, ...(emailId ? { email: emailId } : {}) },
        signal,
      }),
    enabled: !!debounced,
    placeholderData: keepPreviousData,
  });
}

/** What an email to past campers can use (the same for every organization). */
export function useOrganizationEmailDescription(organizationId: string | number) {
  return useQuery({
    queryKey: ['TemplateDescription', 'organization', String(organizationId)],
    queryFn: () => apiFetch<TemplateDescription>(`${base(organizationId)}/templates/describe`),
    staleTime: 5 * 60_000,
  });
}

export interface OrganizationEmailPreviewRequest {
  template: string;
  subject: string;
  filter: EmailFilter;
  recipient_key?: string;
}

/** One person's copy of unsaved subject and body (debounced; the last stays shown). */
export function useOrganizationEmailPreview(
  organizationId: string | number,
  request: OrganizationEmailPreviewRequest | null,
) {
  const [debounced] = useDebouncedValue(request, PREVIEW_DEBOUNCE_MS);
  return useQuery({
    queryKey: ['MultiEvent', String(organizationId), 'email-preview', debounced],
    queryFn: ({ signal }) =>
      apiFetch<TemplatePreviewResponse>(`${base(organizationId)}/templates/preview`, {
        method: 'POST',
        body: { ...debounced, output: 'email' },
        signal,
      }),
    enabled: !!debounced,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  });
}

/** Send an email to the reviewed people (now or later); the batch comes back. */
export function useSendOrganizationEmail() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ emailId, ...body }: EmailSendRequest & { emailId: number }) =>
      apiFetch<ApiEmailBatch>(`/api/organization-emails/${emailId}/send/`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => {
      for (const key of ['EmailBatch', 'EmailMessage', 'EmailAudience']) {
        void client.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

/** Send one copy, marked [Test], to you (or `to`). */
export function useTestOrganizationEmail() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ emailId, ...body }: OrganizationEmailTestRequest & { emailId: number }) =>
      apiFetch<EmailTemplateTestResponse>(`/api/organization-emails/${emailId}/test/`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['EmailMessage'] }),
  });
}
