/**
 * Server-rendered Jinja templates (SPEC §5, §9.6): the variable spec that
 * drives the editor's autocomplete and help, live previews of unsaved
 * template text, and the check of every saved template.
 */

import { useDebouncedValue } from '@mantine/hooks';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  TemplateCheckResponse,
  TemplateDescription,
  TemplatePreviewRequest,
  TemplatePreviewResponse,
} from 'api-types';
import { apiFetch } from 'utils/fetch';

/** How long to wait after the last keystroke before re-rendering a preview. */
export const PREVIEW_DEBOUNCE_MS = 600;

/**
 * What each kind of template can use, for this event (its own form questions
 * and pricing included). It only changes when the event's forms do.
 */
export function useTemplateDescription(eventId: string | number | undefined) {
  return useQuery({
    queryKey: ['TemplateDescription', String(eventId)],
    queryFn: () => apiFetch<TemplateDescription>(`/api/events/${eventId}/templates/describe`),
    enabled: eventId !== undefined && eventId !== '',
    staleTime: 5 * 60_000,
  });
}

/**
 * Render unsaved template text against real data. Debounced, and the last
 * result stays on screen while the next one renders.
 */
export function useTemplatePreview(
  eventId: string | number | undefined,
  request: TemplatePreviewRequest | null,
) {
  const [debounced] = useDebouncedValue(request, PREVIEW_DEBOUNCE_MS);
  return useQuery({
    queryKey: ['TemplatePreview', String(eventId), debounced],
    queryFn: ({ signal }) =>
      apiFetch<TemplatePreviewResponse>(`/api/events/${eventId}/templates/preview`, {
        method: 'POST',
        body: debounced,
        signal,
      }),
    enabled: eventId !== undefined && eventId !== '' && !!debounced,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  });
}

/** Render (or parse) every saved template of an event and report problems. */
export function useTemplateCheck(eventId: string | number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['TemplateCheck', String(eventId)],
    queryFn: () => apiFetch<TemplateCheckResponse>(`/api/events/${eventId}/templates/check`),
    enabled: enabled && eventId !== undefined && eventId !== '',
  });
}
