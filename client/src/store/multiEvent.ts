/**
 * Multi-event reports (SPEC §8.12; §15 DR-177–DR-180): an organization's
 * included events, the camper records in them, the suggested matches, and
 * attendance and retention stats — and including events, linking and unlinking
 * records, and dismissing suggestions. Every change refetches the whole area,
 * since a link changes the records, the suggestions and the stats alike —
 * rendered multi-event reports included (DR-181).
 */

import { useDebouncedValue } from '@mantine/hooks';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiLinkResult,
  ApiMultiEventCamper,
  ApiMultiEventEvent,
  ApiMultiEventStats,
  ApiOrganizationReport,
  ApiPersonSuggestion,
  ApiRenderedReport,
  MultiEventInclusionRequest,
  OrganizationTemplatePreviewRequest,
  TemplateDescription,
  TemplatePreviewResponse,
} from 'api-types';
import { PREVIEW_DEBOUNCE_MS } from 'store/templates';
import { apiFetch } from 'utils/fetch';

const KEY = 'MultiEvent';

const base = (organizationId: string | number) =>
  `/api/organizations/${organizationId}/multi-event`;

function useMultiEventQuery<T>(organizationId: string | number, path: string) {
  return useQuery({
    queryKey: [KEY, String(organizationId), path],
    queryFn: ({ signal }) => apiFetch<T>(`${base(organizationId)}/${path}`, { signal }),
  });
}

/** The organization's events in the event chooser's order, each included or not. */
export function useMultiEventEvents(organizationId: string | number) {
  return useMultiEventQuery<ApiMultiEventEvent[]>(organizationId, 'events');
}

/** The live camper records of the included events. */
export function useMultiEventCampers(organizationId: string | number) {
  return useMultiEventQuery<ApiMultiEventCamper[]>(organizationId, 'campers');
}

/** The suggested matches, strongest first. */
export function usePersonSuggestions(organizationId: string | number) {
  return useMultiEventQuery<ApiPersonSuggestion[]>(organizationId, 'suggestions');
}

/** Attendance and retention across the included events, or one series' ('' for all). */
export function useMultiEventStats(organizationId: string | number, series: string) {
  const query = series ? `?series=${encodeURIComponent(series)}` : '';
  return useMultiEventQuery<ApiMultiEventStats>(organizationId, `stats${query}`);
}

function useMultiEventMutation<V, R>(
  organizationId: string | number,
  request: (variables: V) => { path: string; method: string; body: unknown },
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (variables: V) => {
      const { path, method, body } = request(variables);
      return apiFetch<R>(`${base(organizationId)}/${path}`, { method, body });
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [KEY, String(organizationId)] });
      // A camper's record shows who it's linked to.
      void client.invalidateQueries({ queryKey: ['Camper'] });
    },
  });
}

/** Include or leave out an event, or set its series. */
export function useSetInclusion(organizationId: string | number) {
  return useMultiEventMutation<MultiEventInclusionRequest & { event: number }, ApiMultiEventEvent>(
    organizationId,
    ({ event, ...body }) => ({ path: `events/${event}`, method: 'PATCH', body }),
  );
}

/** Link camper records (and the people they belong to) as one person. */
export function useLinkRecords(organizationId: string | number) {
  return useMultiEventMutation<number[], ApiLinkResult>(organizationId, (campers) => ({
    path: 'link',
    method: 'POST',
    body: { campers },
  }));
}

/**
 * Take camper records out of their person: one is then linked to no one; two or
 * more are split off together as another person, which the answer names.
 */
export function useUnlinkRecords(organizationId: string | number) {
  return useMultiEventMutation<number[], { person: number | null }>(organizationId, (campers) => ({
    path: 'unlink',
    method: 'POST',
    body: { campers },
  }));
}

/** These records aren't one person: don't suggest them together again. */
export function useDismissSuggestion(organizationId: string | number) {
  return useMultiEventMutation<number[], null>(organizationId, (campers) => ({
    path: 'dismiss',
    method: 'POST',
    body: { campers },
  }));
}

/** What multi-event report templates can use (the same for every organization). */
export function useOrganizationTemplateDescription(organizationId: string | number) {
  return useQuery({
    queryKey: ['TemplateDescription', 'organization', String(organizationId)],
    queryFn: () => apiFetch<TemplateDescription>(`${base(organizationId)}/templates/describe`),
    staleTime: 5 * 60_000,
  });
}

/**
 * Render unsaved multi-event report text against the organization's data.
 * Debounced, and the last result stays on screen while the next one renders.
 */
export function useOrganizationTemplatePreview(
  organizationId: string | number,
  request: OrganizationTemplatePreviewRequest | null,
) {
  const [debounced] = useDebouncedValue(request, PREVIEW_DEBOUNCE_MS);
  return useQuery({
    queryKey: [KEY, String(organizationId), 'templates/preview', debounced],
    queryFn: ({ signal }) =>
      apiFetch<TemplatePreviewResponse>(`${base(organizationId)}/templates/preview`, {
        method: 'POST',
        body: debounced,
        signal,
      }),
    enabled: !!debounced,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * A multi-event report rendered for every included event, or one series. Keyed
 * on its last save, and refetched with the rest of the area when a link or an
 * included event changes.
 */
export function useRenderedOrganizationReport(report: ApiOrganizationReport, series?: string) {
  return useQuery({
    queryKey: [KEY, String(report.organization), 'report', report.id, report.updated_at, series],
    queryFn: () =>
      apiFetch<ApiRenderedReport>(`/api/organization-reports/${report.id}/render`, {
        method: 'POST',
        body: series ? { series } : {},
      }),
    staleTime: 30_000,
  });
}
