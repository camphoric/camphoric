/**
 * An invoice's public pay page (SPEC §9.7; §15, DR-95): the page's data by its
 * link code, and paying it online — the server creates the PayPal order and
 * captures it (DR-90). A payment that doesn't go through is an error carrying
 * the page as it is now and why (`ApiInvoicePayProblem`).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiInvoicePay, ApiInvoicePayProblem, PaymentType } from 'api-types';
import { ApiError, apiFetch } from 'utils/fetch';

const payUrl = (token: string, step = '') =>
  `/api/invoices/pay/${encodeURIComponent(token)}${step ? `/${step}` : ''}`;

const key = (token: string) => ['InvoicePay', token];

export function useInvoicePay(token: string) {
  return useQuery({
    queryKey: key(token),
    queryFn: ({ signal }) => apiFetch<ApiInvoicePay>(payUrl(token), { signal }),
    retry: false,
    meta: { suppressErrorNotification: true },
  });
}

/** PayPal's button: the server creates the order → its id. */
export function useCreateInvoiceOrder(token: string) {
  return useMutation({
    mutationFn: (paymentType: PaymentType) =>
      apiFetch<ApiInvoicePay & { orderID: string }>(payUrl(token, 'order'), {
        method: 'POST',
        body: { paymentType },
      }),
    meta: { suppressErrorNotification: true },
  });
}

/** The payer approved: the server checks and captures the order. */
export function useCaptureInvoiceOrder(token: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ orderID, paymentType }: { orderID: string; paymentType: PaymentType }) =>
      apiFetch<ApiInvoicePay>(payUrl(token, 'capture'), {
        method: 'POST',
        body: { orderID, paymentType },
      }),
    onSuccess: (page) => client.setQueryData(key(token), page),
    onError: (error) => {
      const page = invoicePayProblem(error);
      if (page) client.setQueryData(key(token), page);
    },
    meta: { suppressErrorNotification: true },
  });
}

/** The problem a pay-page step reported, with the page as it is now, if it said. */
export function invoicePayProblem(error: unknown): ApiInvoicePayProblem | null {
  if (error instanceof ApiError && error.body && typeof error.body === 'object') {
    const body = error.body as Partial<ApiInvoicePayProblem>;
    if (body.invoice && body.code) return body as ApiInvoicePayProblem;
  }
  return null;
}
