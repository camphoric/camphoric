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

export function useRegistrationConfig(eventId: string) {
  // The query string may carry an invitation code, so it's part of the key.
  const search = window.location.search;
  return useQuery({
    queryKey: ['RegisterConfig', eventId, search],
    queryFn: ({ signal }) => apiFetch<ApiRegister>(registerUrl(eventId, search), { signal }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
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
