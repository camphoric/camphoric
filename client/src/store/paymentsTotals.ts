/**
 * The event's money in totals (SPEC §5, §8.11; §15, DR-173), worked out on the
 * server from each registration's ledger and price lines.
 *
 * Its key sits in the `Registration` namespace, as the "needs attention"
 * list's does (store/paymentsAttention.ts): everything that changes a
 * registration's ledger refetches `Registration`, locally and from the live
 * change feed (DR-112), so the totals follow.
 */

import { useQuery } from '@tanstack/react-query';
import type { ApiPaymentsTotals, Scalar } from 'api-types';
import { apiFetch } from 'utils/fetch';

export function usePaymentsTotals(eventId: Scalar, enabled = true) {
  return useQuery({
    queryKey: ['Registration', 'paymentsTotals', String(eventId)],
    queryFn: ({ signal }) =>
      apiFetch<ApiPaymentsTotals>(`/api/events/${eventId}/payments-totals/`, { signal }),
    enabled,
  });
}
