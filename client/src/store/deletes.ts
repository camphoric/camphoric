/**
 * Deletes, restores and change history (SPEC §5; §15 DR-53, DR-54, DR-55):
 * - what a delete would do, asked before confirming it (`useDeletePreview`);
 * - the deleted registrations, campers, payments and promo codes, and restoring one;
 * - a registration's or camper's change history;
 * - cancelling a camper, keeping a cancellation fee (§8.5; §15, DR-170).
 *
 * Every entity mutation invalidates the `History` and `Deleted` namespaces
 * (store/createEntityHooks), so these stay current.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiCustomCharge,
  ApiDeletedCamper,
  ApiDeletedPayment,
  ApiDeletedPromoCode,
  ApiDeletedRegistration,
  ApiDeletePreview,
  ApiHistoryEntry,
  Scalar,
} from 'api-types';
import { apiFetch, ifMatch } from 'utils/fetch';

import { type ListParams, toQuery } from './createEntityHooks';

/** The entities that are soft-deleted and can be restored. */
export type RestorablePath = 'registrations' | 'campers' | 'payments' | 'promocodes';

/** The entities with a change history. */
export type HistoryPath = 'registrations' | 'campers';

/**
 * What deleting `/api/{path}/{id}/` would do. Always fetched fresh: it's asked
 * right before a delete is confirmed.
 */
export function useDeletePreview(path: string, id: Scalar) {
  return useQuery({
    queryKey: ['DeletePreview', path, id],
    queryFn: ({ signal }) =>
      apiFetch<ApiDeletePreview>(`/api/${path}/${id}/delete-preview/`, { signal }),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

// The deleted lists filter by `event`, campers' and payments' also by `registration`.
function useDeleted<T>(
  path: RestorablePath,
  params: ListParams<'event' | 'registration'>,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['Deleted', path, toQuery(params)],
    queryFn: ({ signal }) => apiFetch<T[]>(`/api/${path}/deleted/${toQuery(params)}`, { signal }),
    enabled,
  });
}

export const useDeletedRegistrations = (eventId: Scalar, enabled = true) =>
  useDeleted<ApiDeletedRegistration>('registrations', { event: eventId }, enabled);

export const useDeletedCampers = (eventId: Scalar, enabled = true) =>
  useDeleted<ApiDeletedCamper>('campers', { event: eventId }, enabled);

/** Deleted payments, for an event (`event`) or one registration (`registration`). */
export const useDeletedPayments = (params: ListParams<'event' | 'registration'>, enabled = true) =>
  useDeleted<ApiDeletedPayment>('payments', params, enabled);

export const useDeletedPromoCodes = (eventId: Scalar, enabled = true) =>
  useDeleted<ApiDeletedPromoCode>('promocodes', { event: eventId }, enabled);

// A restore brings back a registration's campers, payments and charges too, and
// changes its totals and the lodging counts.
const RESTORE_INVALIDATES = [
  'Registration',
  'Camper',
  'Payment',
  'Invoice',
  'CustomCharge',
  'PromoCode',
  'Deleted',
  'History',
];

/** Restore a deleted registration, camper, payment or promo code. */
export function useRestore(path: RestorablePath) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: Scalar) =>
      apiFetch<unknown>(`/api/${path}/${id}/restore/`, { method: 'POST' }),
    onSuccess: () =>
      RESTORE_INVALIDATES.forEach((name) => void client.invalidateQueries({ queryKey: [name] })),
  });
}

/** A registration's changes (with its campers', payments' and charges'), or a camper's. */
export function useHistory(path: HistoryPath, id: Scalar) {
  return useQuery({
    queryKey: ['History', path, id],
    queryFn: ({ signal }) => apiFetch<ApiHistoryEntry[]>(`/api/${path}/${id}/history/`, { signal }),
  });
}

/** What cancelling a camper keeps (§8.5; §15, DR-170): a fee, or nothing. */
export interface CancellationFee {
  amount: number;
  notes: string;
}

// A cancel deletes the camper and may add a charge (and the event's
// cancellation-fee type): the registration's totals and lists all move.
const CANCEL_INVALIDATES = [
  'Registration',
  'Camper',
  'CustomCharge',
  'CustomChargeType',
  'Deleted',
  'History',
];

/**
 * Cancel a camper: `POST /api/campers/{id}/cancel/` `{ cancellation_fee }` deletes
 * them (as a delete does, restorably) and keeps the fee, if any, as a charge of
 * the registration's own — both or neither. Refused (412) when the camper has
 * changed since the `version` the user saw (§9.8, DR-109).
 */
export function useCancelCamper() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      version,
      fee,
    }: {
      id: Scalar;
      version?: number;
      fee: CancellationFee | null;
    }) =>
      apiFetch<{ cancellation_fee: ApiCustomCharge | null }>(`/api/campers/${id}/cancel/`, {
        method: 'POST',
        body: { cancellation_fee: fee },
        headers: ifMatch(version),
      }),
    onSettled: () =>
      CANCEL_INVALIDATES.forEach((name) => void client.invalidateQueries({ queryKey: [name] })),
  });
}
