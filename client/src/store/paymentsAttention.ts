/**
 * The event's "needs attention" list (SPEC §5, §8.11; §15, DR-168): refunds
 * due, overpaid invoices, balances no invoice asks for, invoices past due and
 * PayPal orders to check — built on the server from each registration's ledger.
 *
 * Its key sits in the `Registration` namespace on purpose: everything that can
 * change a registration's ledger (a payment, an invoice, a charge, a price
 * override, a camper) already refetches `Registration`, from this tab's own
 * changes and from the live change feed (DR-112), so the list follows them.
 */

import { useQuery } from '@tanstack/react-query';
import type { ApiPaymentsAttentionItem, Scalar } from 'api-types';
import { apiFetch } from 'utils/fetch';

export function usePaymentsAttention(eventId: Scalar) {
  return useQuery({
    queryKey: ['Registration', 'paymentsAttention', String(eventId)],
    queryFn: ({ signal }) =>
      apiFetch<ApiPaymentsAttentionItem[]>(`/api/events/${eventId}/payments-attention/`, {
        signal,
      }),
  });
}
