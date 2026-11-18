/**
 * Deleting (cancelling) a camper, with the offer to keep a cancellation fee
 * (SPEC §8.5; §15, DR-168). The confirmation shows the server's delete preview
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
import { type CancellationFee, useCancelCamper, useDeletePreview } from 'store/deletes';
import { customChargeHooks } from 'store/entities';
import { apiFetch } from 'utils/fetch';
import { formatMoney } from 'utils/money';

interface CancelCamperOptions {
  camperId: Scalar;
  /** The version the user saw, so a camper changed since isn't deleted (§9.8). */
  version?: number;
  /** The camper's name, e.g. Pat Alpha. */
  name: string;
  onCancelled: () => void;
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
  version,
  name,
  onCancelled,
  onClose,
}: CancelCamperOptions & { onClose: () => void }) {
  const preview = useDeletePreview('campers', camperId);
  const cancel = useCancelCamper();
  return (
    <CancelCamperView
      name={name}
      preview={preview.data}
      error={preview.error}
      onCancel={onClose}
      onConfirm={(fee) => {
        cancel.mutate(
          { id: camperId, version, fee },
          {
            onSuccess: () => {
              notifications.show({
                color: 'green',
                message: fee
                  ? `Deleted ${name}, keeping a ${formatMoney(fee.amount)} cancellation fee.`
                  : `Deleted ${name}.`,
              });
              onCancelled();
            },
          },
        );
        onClose();
      }}
    />
  );
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
        for (const fee of fees) {
          del.mutate(
            { id: fee.id, version: fee.version },
            {
              onSuccess: () =>
                notifications.show({
                  color: 'green',
                  message: `Removed the ${formatMoney(fee.amount)} cancellation fee.`,
                }),
            },
          );
        }
      },
    });
  };
}
