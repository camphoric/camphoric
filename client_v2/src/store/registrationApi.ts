/**
 * Data layer for the public registration flow (SPEC §5, §7) — the bespoke
 * `/api/events/{eventId}/register` endpoint. The config is a query; the steps
 * (registration, paypal-order, payment, finish) are POST mutations
 * distinguished by `step`.
 *
 * The config is server-authoritative and must not refetch mid-edit, so it uses
 * an infinite staleTime and no refetch-on-focus (DR-16).
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  ApiPayPalOrder,
  ApiRegister,
  ApiRegisterConfirmationStep,
  ApiRegisterPaymentStep,
  AppliedPromo,
  PaymentProblemCode,
  PaymentStepBody,
  PayPalOrderBody,
  PricingResults,
  RegistrationFormData,
} from 'api-types';
import { ApiError, apiFetch } from 'utils/fetch';

const registerUrl = (eventId: string, search = '') => `/api/events/${eventId}/register${search}`;

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
  /** The applied promo code; one the registrant can't use is refused (400). */
  promoCode?: string;
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

/**
 * Checks a promo code the registrant typed: POST /api/events/{id}/checkpromo
 * `{code}` -> the code, or a 400 whose `detail` says it can't be used (§7.1).
 * The form shows that message itself, so there's no error notification.
 */
export function useCheckPromoCode(eventId: string) {
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<AppliedPromo>(`/api/events/${eventId}/checkpromo`, {
        method: 'POST',
        body: { code },
      }),
    meta: { suppressErrorNotification: true },
  });
}

/**
 * Step 2: pay by check (the chosen option), complete a $0 registration, or
 * capture the PayPal order the registrant approved (§7.2; §15, DR-90) ->
 * the confirmation-step payload. A payment that doesn't go through is an
 * error with a {@link paymentProblem} code; the page says what happened.
 */
export function useSubmitPayment(eventId: string) {
  return useMutation({
    mutationFn: (body: PaymentStepBody) =>
      apiFetch<ApiRegisterConfirmationStep>(registerUrl(eventId), {
        method: 'POST',
        body: { step: 'payment', ...body },
      }),
    meta: { suppressErrorNotification: true },
  });
}

/**
 * The PayPal or Card button: the server completes the registration (unpaid
 * until captured; DR-91), makes its invoice and creates the PayPal order.
 */
export function useCreatePayPalOrder(eventId: string) {
  return useMutation({
    mutationFn: (body: PayPalOrderBody) =>
      apiFetch<ApiPayPalOrder>(registerUrl(eventId), {
        method: 'POST',
        body: { step: 'paypal-order', ...body },
      }),
    meta: { suppressErrorNotification: true },
  });
}

/**
 * The registration's payment step as it is now (`payment-step`): a page reopened
 * later shows what's due, which an organizer may have changed (§7.2; §15, DR-105).
 */
export function useRefreshPaymentStep(eventId: string) {
  return useMutation({
    mutationFn: (registrationUUID: string) =>
      apiFetch<ApiRegisterPaymentStep>(registerUrl(eventId), {
        method: 'POST',
        body: { step: 'payment-step', registrationUUID },
      }),
  });
}

/** Finish without paying now, after a PayPal attempt didn't go through. */
export function useFinishRegistration(eventId: string) {
  return useMutation({
    mutationFn: (registrationUUID: string) =>
      apiFetch<ApiRegisterConfirmationStep>(registerUrl(eventId), {
        method: 'POST',
        body: { step: 'finish', registrationUUID },
      }),
  });
}

/**
 * Why a payment step failed: the server's code and message, if it said, and —
 * for `invoice_changed` — the payment step as it is now (§15, DR-105).
 */
export function paymentProblem(error: unknown): {
  code?: PaymentProblemCode;
  message: string;
  paymentStep?: ApiRegisterPaymentStep;
} {
  if (error instanceof ApiError && error.body && typeof error.body === 'object') {
    const body = error.body as {
      code?: PaymentProblemCode;
      detail?: string;
      paymentStep?: ApiRegisterPaymentStep;
    };
    return {
      code: body.code,
      message: body.detail ?? error.message,
      paymentStep: body.paymentStep,
    };
  }
  return { message: error instanceof Error ? error.message : String(error) };
}
