/**
 * Deleting (cancelling) a camper, with the offer to keep a cancellation fee
 * (SPEC §8.5; §15, DR-170). The confirmation shows the server's delete preview
 * (§5, DR-54) and, when the delete can go ahead, offers to keep a fee: an
 * amount and a note. Confirming cancels the camper through
 * `POST /api/campers/{id}/cancel/`, which deletes them and keeps the fee as a
 * charge of the registration's own, so it stays when they go; the registrar
 * then refunds what's left over from the registration's Fees & payments.
 *
 * Restoring a camper offers to remove the fee kept for them
 * (`useOfferToRemoveCancellationFees`).
 */

import { Checkbox, NumberInput, Stack, Text, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import type { ApiCustomCharge, ApiDeletePreview, Scalar } from 'api-types';
import { ConfirmDeleteView } from 'components/ConfirmDelete';
import { useState } from 'react';
import { type CancellationFee, useDeletePreview } from 'store/deletes';
import { customChargeHooks } from 'store/entities';
import { apiFetch } from 'utils/fetch';
import { formatMoney } from 'utils/money';

interface CancelCamperOptions {
  camperId: Scalar;
  /** The camper's name, e.g. Pat Alpha. */
  name: string;
  /**
   * Cancels them, keeping the fee (null: none). It's called as the modal
   * closes, so the caller — which outlives the modal — owns the request
   * (`useCancelCamper`) and what follows it.
   */
  onConfirm: (fee: CancellationFee | null) => void;
}

/** Open the confirmation as a modal. */
export function confirmCancelCamper(options: CancelCamperOptions) {
  const modalId = modals.open({
    title: 'Delete camper',
    children: <CancelCamper {...options} onClose={() => modals.close(modalId)} />,
  });
  return modalId;
}

function CancelCamper({
  camperId,
  name,
  onConfirm,
  onClose,
}: CancelCamperOptions & { onClose: () => void }) {
  const preview = useDeletePreview('campers', camperId);
  return (
    <CancelCamperView
      name={name}
      preview={preview.data}
      error={preview.error}
      onCancel={onClose}
      onConfirm={(fee) => {
        onConfirm(fee);
        onClose();
      }}
    />
  );
}

/** The notification once a camper is cancelled. */
export function cancelledMessage(name: string, fee: CancellationFee | null): string {
  return fee
    ? `Deleted ${name}, keeping a ${formatMoney(fee.amount)} cancellation fee.`
    : `Deleted ${name}.`;
}

export interface CancelCamperViewProps {
  name: string;
  /** Undefined while it's being worked out. */
  preview?: ApiDeletePreview;
  error?: unknown;
  /** With the fee to keep, or null for none. */
  onConfirm: (fee: CancellationFee | null) => void;
  onCancel: () => void;
}

export function CancelCamperView({
  name,
  preview,
  error,
  onConfirm,
  onCancel,
}: CancelCamperViewProps) {
  const [keepFee, setKeepFee] = useState(false);
  const [amount, setAmount] = useState<number | string>('');
  const [notes, setNotes] = useState(`Cancellation: ${name}`);

  const fee = Number(amount);
  const feeComplete = amount !== '' && Number.isFinite(fee) && fee > 0;

  return (
    <ConfirmDeleteView
      message={<>Delete the camper “{name}”?</>}
      preview={preview}
      error={error}
      confirmDisabled={keepFee && !feeComplete}
      onCancel={onCancel}
      onConfirm={() => onConfirm(keepFee ? { amount: fee, notes: notes.trim() } : null)}
    >
      <Stack gap="xs">
        <Checkbox
          label="Keep a cancellation fee"
          description="It stays on the registration after the camper goes. Refund the rest from the registration’s Fees & payments."
          checked={keepFee}
          onChange={(e) => setKeepFee(e.currentTarget.checked)}
        />
        {keepFee && (
          <>
            <NumberInput
              label="Fee"
              prefix="$"
              min={0.01}
              decimalScale={2}
              allowNegative={false}
              value={amount}
              onChange={setAmount}
              error={amount !== '' && !feeComplete ? 'Enter an amount above $0.' : undefined}
              data-autofocus
            />
            <TextInput
              label="Note"
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />
          </>
        )}
      </Stack>
    </ConfirmDeleteView>
  );
}

/** The cancellation fees kept for a camper, as listed for the restore offer. */
export function feesSummary(fees: ApiCustomCharge[]): string {
  return fees
    .map((fee) => `${formatMoney(fee.amount)}${fee.notes ? ` (${fee.notes})` : ''}`)
    .join(', ');
}

/**
 * After a camper is restored: when a cancellation fee was kept for them, offer
 * to remove it (it isn't removed unasked: the camp may keep it anyway).
 */
export function useOfferToRemoveCancellationFees() {
  const del = customChargeHooks.useDelete();
  return async (camperId: Scalar, name: string) => {
    const fees = await apiFetch<ApiCustomCharge[]>(
      `/api/customcharges/?cancelled_camper=${encodeURIComponent(String(camperId))}`,
    );
    if (fees.length === 0) return;
    modals.openConfirmModal({
      title: 'Remove the cancellation fee?',
      children: (
        <Text size="sm">
          A cancellation fee was kept for {name} when they were deleted: {feesSummary(fees)}. Remove
          it from the registration now they’re back?
        </Text>
      ),
      labels: { confirm: fees.length === 1 ? 'Remove fee' : 'Remove fees', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        // Each delete awaited, so every one is reported however many there are.
        void Promise.allSettled(
          fees.map((fee) => del.mutateAsync({ id: fee.id, version: fee.version })),
        ).then((results) => {
          const removed = fees.filter((_, i) => results[i].status === 'fulfilled');
          if (removed.length > 0) {
            notifications.show({
              color: 'green',
              message: `Removed the cancellation fee: ${feesSummary(removed)}.`,
            });
          }
        });
      },
    });
  };
}
