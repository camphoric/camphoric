/**
 * Make an invoice by hand (SPEC §8.4, §9.7; §15, DR-96): what it's for, the
 * amount — "Use the balance" fills what no open invoice asks for yet — a due
 * date, a memo for the payer and internal notes. It gets a pay link to copy or
 * send; paying it online adds the handling fee then (DR-88).
 */

import { Button, Group, Modal, NumberInput, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import type { ApiInvoice, Scalar } from 'api-types';
import { useEffect, useState } from 'react';
import { useCreateInvoice } from 'store/invoices';
import { apiErrorMessage, apiFieldErrors } from 'utils/fetch';
import { formatMoney, roundMoney } from 'utils/money';

export interface NewInvoiceModalProps {
  registrationId: Scalar;
  /** The balance no open invoice asks for yet. */
  uninvoicedBalance: number;
  opened: boolean;
  onClose: () => void;
  onCreated?: (invoice: ApiInvoice) => void;
}

export function NewInvoiceModal({
  registrationId,
  uninvoicedBalance,
  opened,
  onClose,
  onCreated,
}: NewInvoiceModalProps) {
  const create = useCreateInvoice();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | string>(0);
  const [dueOn, setDueOn] = useState('');
  const [memo, setMemo] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!opened) return;
    // Most invoices are for what's left to pay.
    setDescription(uninvoicedBalance > 0 ? 'Registration balance' : '');
    setAmount(uninvoicedBalance > 0 ? roundMoney(uninvoicedBalance) : 0);
    setDueOn('');
    setMemo('');
    setNotes('');
    create.reset();
    // Start afresh each time it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const errors = apiFieldErrors(create.error);
  const otherError = create.error && Object.keys(errors).length === 0;

  const save = () =>
    create.mutate(
      {
        registration: registrationId,
        description,
        amount: (Number(amount) || 0).toFixed(2),
        memo,
        notes,
        due_on: dueOn || null,
      },
      {
        onSuccess: (invoice) => {
          notifications.show({ color: 'green', message: `Invoice #${invoice.id} made` });
          onCreated?.(invoice);
          onClose();
        },
      },
    );

  return (
    <Modal opened={opened} onClose={onClose} title="New invoice">
      <Stack>
        <TextInput
          label="Description"
          placeholder="e.g. Registration balance, Meal plan"
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
          <Button
            variant="light"
            onClick={() => setAmount(roundMoney(uninvoicedBalance))}
            disabled={uninvoicedBalance <= 0}
          >
            Use the balance
          </Button>
        </Group>
        <Text size="xs" c="dimmed" mt={-12}>
          {uninvoicedBalance > 0
            ? `${formatMoney(uninvoicedBalance)} of the balance isn’t on an invoice yet.`
            : 'All of the balance is on invoices already.'}{' '}
          Paying online adds the handling fee.
        </Text>
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
        {otherError && (
          <Text size="sm" c="red" role="alert">
            {apiErrorMessage(create.error)}
          </Text>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={create.isPending} disabled={!(Number(amount) > 0)}>
            Make invoice
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
