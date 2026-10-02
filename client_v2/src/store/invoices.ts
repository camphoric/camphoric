/**
 * Invoice and refund actions (SPEC §8.4, §9.7): cancelling and reopening an
 * invoice, checking a pending PayPal order, recording a payment (optionally on
 * a chosen invoice), and refunding through PayPal. Listing, editing and
 * deleting invoices go through `invoiceHooks` (store/entities).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiInvoice, ApiPayment, Hash, PaymentType, Scalar } from 'api-types';
import { apiFetch } from 'utils/fetch';

// A payment or an invoice change moves the registration's ledger and its history.
const INVALIDATES = ['Invoice', 'Payment', 'Registration', 'History', 'Deleted'];

function useInvalidate() {
  const client = useQueryClient();
  return () => INVALIDATES.forEach((name) => void client.invalidateQueries({ queryKey: [name] }));
}

/** `POST /api/invoices/{id}/cancel/` `{reason}` or `/reopen/`. */
export function useInvoiceStatusAction(action: 'cancel' | 'reopen') {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: Scalar; reason?: string }) =>
      apiFetch<ApiInvoice>(`/api/invoices/${id}/${action}/`, {
        method: 'POST',
        body: action === 'cancel' ? { reason: reason ?? '' } : {},
      }),
    onSuccess: invalidate,
  });
}

export interface CheckPayPalResult {
  result: 'recorded' | 'not_captured';
  payment: ApiPayment | null;
  invoice: ApiInvoice;
}

/** Ask PayPal about an invoice's pending order: recorded if captured, else cleared. */
export function useCheckPayPalOrder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: Scalar) =>
      apiFetch<CheckPayPalResult>(`/api/invoices/${id}/check-paypal/`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

/**
 * A payment, or a refund (a negative amount), to record (§15, DR-87, DR-94).
 * With no invoice it goes on the registration's oldest one with money due, or
 * a new "Payment received" one (`new_invoice` asks for that).
 */
export interface RecordPaymentBody {
  registration: Scalar;
  invoice?: Scalar;
  new_invoice?: boolean;
  refund_of?: Scalar;
  payment_type: PaymentType;
  paid_on: string | null;
  amount: number;
  notes: string;
  attributes: Hash;
}

export function useRecordPayment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: RecordPaymentBody) =>
      apiFetch<ApiPayment>('/api/payments/', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export interface RefundPayPalBody {
  payment: Scalar;
  amount: number;
  reason: string;
  /** Made once per refund attempt, so a retried click refunds once. */
  requestId: string;
}

/** Refund some or all of a PayPal or card payment through PayPal (§15, DR-94). */
export function useRefundPayPal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ payment, amount, reason, requestId }: RefundPayPalBody) =>
      apiFetch<ApiPayment>(`/api/payments/${payment}/refund-paypal/`, {
        method: 'POST',
        body: { amount, reason, request_id: requestId },
      }),
    onSuccess: invalidate,
  });
}
