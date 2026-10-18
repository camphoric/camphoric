/**
 * Edit an invoice (SPEC §8.4, §9.7): its description, amount, handling fee, due
 * date, memo (shown to the payer) and internal notes. "Use the balance" fills
 * the amount from what no other invoice asks for yet; "Calculate" fills the
 * handling fee the way the server charges it when the invoice is paid online
 * (§15, DR-88). While PayPal is processing a payment on it, its amount and
 * handling fee stay as they are: the payment is recorded as what it asked then
 * (§15, DR-133).
 */

import { Button, Group, Modal, NumberInput, Stack, Textarea, TextInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import type { ApiInvoice } from 'api-types';
import { FormActions } from 'components/FormActions';
import { useConflictAwareSave } from 'hooks/useEditableRecord';
import { handlingFee } from 'pricing';
import { useEffect, useState } from 'react';
import { invoiceHooks } from 'store/entities';
import { apiFieldErrors } from 'utils/fetch';
import { formatMoney, roundMoney } from 'utils/money';

type InvoiceFields = Pick<
  ApiInvoice,
  'description' | 'amount' | 'handling' | 'due_on' | 'memo' | 'notes'
>;

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
  const update = invoiceHooks.useUpdate({ handlesVersionConflict: true });
  // From the version the dialog opened at, so a change someone else saved —
  // or the registrant's payment step made — meanwhile is never overwritten
  // unseen (§9.8, DR-109).
  const saveInvoice = useConflictAwareSave(invoice ?? undefined, {
    toForm: (record: ApiInvoice): InvoiceFields => ({
      description: record.description,
      amount: record.amount,
      handling: record.handling,
      due_on: record.due_on ?? null,
      memo: record.memo,
      notes: record.notes,
    }),
    saveRecord: update.mutateAsync,
    label: 'invoice',
    fieldLabels: { due_on: 'Due' },
  });
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | string>(0);
  const [handling, setHandling] = useState<number | string>(0);
  const [dueOn, setDueOn] = useState<string>('');
  const [memo, setMemo] = useState('');
  const [notes, setNotes] = useState('');

  const show = (fields: InvoiceFields) => {
    setDescription(fields.description);
    setAmount(Number(fields.amount));
    setHandling(Number(fields.handling));
    setDueOn(fields.due_on ?? '');
    setMemo(fields.memo);
    setNotes(fields.notes);
  };

  useEffect(() => {
    if (!invoice) return;
    show(invoice);
    update.reset();
    // Reset only when a different invoice opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id]);

  if (!invoice) return null;

  // PayPal's payment is recorded as what it asked when the order was made.
  const held = invoice.paypal_capture_pending;

  // What's been paid toward the amount, before any fee (the server's rule).
  const paid = Number(invoice.amount_paid);
  const useBalance = () => setAmount(roundMoney(Number(invoice.amount) + uninvoicedBalance));
  const calculate = () =>
    setHandling(handlingFee(Math.max(0, (Number(amount) || 0) - paid), handlingPercent));

  const errors = apiFieldErrors(update.error);

  const save = async () => {
    const outcome = await saveInvoice(
      {
        description,
        amount: (Number(amount) || 0).toFixed(2),
        handling: (Number(handling) || 0).toFixed(2),
        due_on: dueOn || null,
        memo,
        notes,
      },
      show,
    );
    if (outcome?.discarded) show(outcome.discarded);
    if (outcome?.saved) {
      notifications.show({ color: 'green', message: 'Invoice saved' });
      onClose();
    }
  };

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
            disabled={held}
            style={{ flex: 1 }}
          />
          <Button variant="light" onClick={useBalance} disabled={held || uninvoicedBalance <= 0}>
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
            disabled={held}
            style={{ flex: 1 }}
          />
          <Button variant="light" onClick={calculate} disabled={held || !handlingPercent}>
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
          <Button onClick={() => void save()} loading={update.isPending}>
            Save
          </Button>
        </FormActions>
      </Stack>
    </Modal>
  );
}
