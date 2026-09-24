/**
 * Data layer for the public registration flow (SPEC §5, §7) — the bespoke
 * `/api/events/{eventId}/register` endpoint. The config is a query; the two
 * steps (registration, payment) are POST mutations distinguished by `step`.
 *
 * The config is server-authoritative and must not refetch mid-edit, so it uses
 * an infinite staleTime and no refetch-on-focus (DR-16).
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  ApiRegister,
  ApiRegisterConfirmationStep,
  ApiRegisterPaymentStep,
  InitialPaymentBody,
  PricingResults,
  RegistrationFormData,
} from 'api-types';
import { apiFetch } from 'utils/fetch';

const registerUrl = (eventId: string, search = '') =>
  `/api/events/${eventId}/register${search}`;

export function useRegistrationConfig(eventId: string, search = window.location.search) {
  // The query string may carry an invitation code, so it's part of the key.
  return useQuery({
    queryKey: ['RegisterConfig', eventId, search],
    queryFn: ({ signal }) => apiFetch<ApiRegister>(registerUrl(eventId, search), { signal }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/**
 * The registration form's full schema as registrants receive it (including the
 * server-built lodging fields), for admin tools such as the validation-message
 * editor (§8.8). Unlike `useRegistrationConfig` it ignores the page's query
 * string (no invitation overrides) and refetches normally, so schema edits made
 * elsewhere in Settings show up.
 */
export function useRegistrationFormSchema(eventId: string) {
  return useQuery({
    queryKey: ['RegisterConfigAdmin', eventId],
    queryFn: ({ signal }) => apiFetch<ApiRegister>(registerUrl(eventId), { signal }),
  });
}

export interface SubmitRegistrationBody {
  formData: RegistrationFormData;
  pricingResults: PricingResults;
  invitation?: ApiRegister['invitation'];
}

/** Step 1 submit: POST { step: 'registration', … } -> the payment-step payload. */
export function useSubmitRegistration(eventId: string) {
  return useMutation({
    mutationFn: (body: SubmitRegistrationBody) =>
      apiFetch<ApiRegisterPaymentStep>(registerUrl(eventId), {
        method: 'POST',
        body: { step: 'registration', ...body },
      }),
  });
}

/** Step 2 submit: POST { step: 'payment', … } -> the confirmation-step payload. */
export function useSubmitPayment(eventId: string) {
  return useMutation({
    mutationFn: (body: InitialPaymentBody) =>
      apiFetch<ApiRegisterConfirmationStep>(registerUrl(eventId), {
        method: 'POST',
        body: { step: 'payment', ...body },
      }),
  });
}
