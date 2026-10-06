/**
 * Edit an invoice (SPEC §8.4, §9.7): its description, amount, handling fee, due
 * date, memo (shown to the payer) and internal notes. "Use the balance" fills
 * the amount from what no other invoice asks for yet; "Calculate" fills the
 * handling fee the way the server charges it when the invoice is paid online
 * (§15, DR-88).
 */

import { Button, Group, Modal, NumberInput, Stack, Textarea, TextInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import type { ApiInvoice } from 'api-types';
import { FormActions } from 'components/FormActions';
import { handlingFee } from 'pricing';
import { useEffect, useState } from 'react';
import { invoiceHooks } from 'store/entities';
import { apiFieldErrors } from 'utils/fetch';
import { formatMoney, roundMoney } from 'utils/money';

export interface EditInvoiceModalProps {
  invoice: ApiInvoice | null;
  /** The registration's balance that no open invoice asks for yet. */
  uninvoicedBalance: number;
  /** The event's handling percent, for "Calculate". */
  handlingPercent: number;
  onClose: () => void;
}

export function EditInvoiceModal({
  invoice,
  uninvoicedBalance,
  handlingPercent,
  onClose,
}: EditInvoiceModalProps) {
  const update = invoiceHooks.useUpdate();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | string>(0);
  const [handling, setHandling] = useState<number | string>(0);
  const [dueOn, setDueOn] = useState<string>('');
  const [memo, setMemo] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!invoice) return;
    setDescription(invoice.description);
    setAmount(Number(invoice.amount));
    setHandling(Number(invoice.handling));
    setDueOn(invoice.due_on ?? '');
    setMemo(invoice.memo);
    setNotes(invoice.notes);
    update.reset();
    // Reset only when a different invoice opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id]);

  if (!invoice) return null;

  // What's been paid toward the amount, before any fee (the server's rule).
  const paid = Number(invoice.amount_paid);
  const useBalance = () => setAmount(roundMoney(Number(invoice.amount) + uninvoicedBalance));
  const calculate = () =>
    setHandling(handlingFee(Math.max(0, (Number(amount) || 0) - paid), handlingPercent));

  const errors = apiFieldErrors(update.error);

  const save = () =>
    update.mutate(
      {
        id: invoice.id,
        description,
        amount: (Number(amount) || 0).toFixed(2),
        handling: (Number(handling) || 0).toFixed(2),
        due_on: dueOn || null,
        memo,
        notes,
      },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Invoice saved' });
          onClose();
        },
      },
    );

  return (
    <Modal opened onClose={onClose} title={`Edit invoice #${invoice.id}`}>
      <Stack>
        <TextInput
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          error={errors.description}
        />
        <Group align="flex-end" wrap="nowrap">
          <NumberInput
            label="Amount"
            prefix="$"
            decimalScale={2}
            min={0}
            value={amount}
            onChange={setAmount}
            error={errors.amount}
            style={{ flex: 1 }}
          />
          <Button variant="light" onClick={useBalance} disabled={uninvoicedBalance <= 0}>
            Use the balance
          </Button>
        </Group>
        {uninvoicedBalance > 0 && (
          <Group gap={4} mt={-12}>
            <span style={{ fontSize: 'var(--mantine-font-size-xs)' }}>
              {formatMoney(uninvoicedBalance)} of the balance isn’t on an invoice yet.
            </span>
          </Group>
        )}
        <Group align="flex-end" wrap="nowrap">
          <NumberInput
            label="Electronic payment handling"
            prefix="$"
            decimalScale={2}
            min={0}
            value={handling}
            onChange={setHandling}
            error={errors.handling}
            style={{ flex: 1 }}
          />
          <Button variant="light" onClick={calculate} disabled={!handlingPercent}>
            Calculate
          </Button>
        </Group>
        <DateInput
          label="Due on"
          valueFormat="MM/DD/YYYY"
          clearable
          value={dueOn || null}
          onChange={(value) => setDueOn(value ?? '')}
        />
        <Textarea
          label="Memo"
          description="Shown to the payer"
          autosize
          minRows={2}
          value={memo}
          onChange={(e) => setMemo(e.currentTarget.value)}
        />
        <Textarea
          label="Notes"
          description="Internal: registrars, admins and reporters see these"
          autosize
          minRows={2}
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
        />
        <FormActions>
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={update.isPending}>
            Save
          </Button>
        </FormActions>
      </Stack>
    </Modal>
  );
}
