/**
 * Set a registrar's amount for one price line, with the reason (SPEC §8.4,
 * §8.5; §15, DR-56): shows what the pricing works out for the line, and saves
 * a new override or changes the existing one.
 */

import { Button, Modal, NumberInput, Stack, Text, Textarea } from '@mantine/core';
import type { ApiPricingOverride, Scalar } from 'api-types';
import type { FeeLine } from 'components/FeeBreakdown';
import { FormActions } from 'components/FormActions';
import { useConflictAwareSave } from 'hooks/useEditableRecord';
import { useHasChanged } from 'hooks/useHasChanged';
import { useState } from 'react';
import { pricingOverrideHooks } from 'store/entities';
import { formatMoney } from 'utils/money';

export interface OverrideTarget {
  registration: Scalar;
  /** Null: a line of the registration itself. */
  camper: Scalar | null;
}

interface OverrideModalProps extends OverrideTarget {
  /** The line being overridden; null closes the dialog. */
  line: FeeLine | null;
  onClose: () => void;
}

export function OverrideModal({ registration, camper, line, onClose }: OverrideModalProps) {
  const create = pricingOverrideHooks.useCreate();
  const update = pricingOverrideHooks.useUpdate({ handlesVersionConflict: true });
  // From the version the dialog opened at (§9.8, DR-109).
  const saveOverride = useConflictAwareSave(line?.override, {
    toForm: (record: ApiPricingOverride) => ({
      amount: Number(record.amount).toFixed(2),
      reason: record.reason,
    }),
    saveRecord: update.mutateAsync,
    label: 'override',
  });
  const [amount, setAmount] = useState<number | string>('');
  const [reason, setReason] = useState('');

  const show = (fields: { amount: number | string; reason: string }) => {
    setAmount(Number(fields.amount));
    setReason(fields.reason);
  };

  const lineChanged = useHasChanged(line);
  if (lineChanged) {
    setAmount(line?.override ? Number(line.override.amount) : '');
    setReason(line?.override?.reason ?? '');
  }

  const ready = line !== null && amount !== '' && reason.trim() !== '';
  const saving = create.isPending || update.isPending;

  const save = async () => {
    if (!line || !ready) return;
    const body = { amount: Number(amount), reason: reason.trim() };
    if (line.override) {
      const outcome = await saveOverride(
        { amount: body.amount.toFixed(2), reason: body.reason },
        show,
      );
      if (outcome?.saved) onClose();
      if (outcome?.discarded) show(outcome.discarded);
    } else create.mutate({ registration, camper, var: line.key, ...body }, { onSuccess: onClose });
  };

  return (
    <Modal opened={line !== null} onClose={onClose} title={line ? `Override ${line.label}` : ''}>
      {line && (
        <Stack>
          <Text size="sm">
            The pricing works out {formatMoney(line.computed)} for this line. The amount you set
            replaces it, and the totals follow; the registrant only sees the new amount.
          </Text>
          <NumberInput
            label="Amount"
            prefix="$"
            decimalScale={2}
            value={amount}
            onChange={setAmount}
            data-autofocus
          />
          <Textarea
            label="Reason"
            description="Who asked, or why — kept with the change history."
            autosize
            minRows={2}
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
          />
          <FormActions>
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={!ready} loading={saving}>
              {line.override ? 'Save' : 'Override'}
            </Button>
          </FormActions>
        </Stack>
      )}
    </Modal>
  );
}
