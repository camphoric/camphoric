/**
 * Record a payment against a registration (SPEC §8.4, §9.7): its type
 * (Check/PayPal/Card/Voucher), paid-on date, amount, the event's
 * `payment_schema` fields, notes, and which invoice it pays. Every payment
 * belongs to an invoice (§15, DR-87): it defaults to the oldest one with money
 * due (and fills in what's due on it), or goes "on its own" — a new "Payment
 * received" invoice for exactly it. An invoice can take any number of
 * payments, say a second check.
 */

import { Button, Group, Modal, NumberInput, Select, Stack, TextInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import type { ApiEvent, ApiInvoice, Hash, PaymentType, Scalar } from 'api-types';
import { JsonSchemaForm } from 'components/form';
import { useEffect, useState } from 'react';
import { useRecordPayment } from 'store/invoices';
import { apiErrorMessage } from 'utils/fetch';
import { formatMoney } from 'utils/money';

const PAYMENT_TYPES: PaymentType[] = ['Check', 'PayPal', 'Card', 'Voucher'];
/** The "Apply to" choice for a new invoice of its own. */
export const ON_ITS_OWN = 'own';

export const invoiceChoiceLabel = (invoice: ApiInvoice) =>
  `#${invoice.id}${invoice.description ? ` · ${invoice.description}` : ''} · ` +
  `${formatMoney(invoice.amount_due)} due`;

export interface RecordPaymentModalProps {
  event: ApiEvent;
  registrationId: Scalar;
  /** The registration's invoices, oldest first. */
  invoices: ApiInvoice[];
  opened: boolean;
  onClose: () => void;
}

export function RecordPaymentModal({
  event,
  registrationId,
  invoices,
  opened,
  onClose,
}: RecordPaymentModalProps) {
  const record = useRecordPayment();
  const open = invoices.filter((i) => i.status === 'open' || i.status === 'partially_paid');

  const [type, setType] = useState<PaymentType>('Check');
  const [paidOn, setPaidOn] = useState<string>('');
  const [amount, setAmount] = useState<number | string>(0);
  const [notes, setNotes] = useState('');
  const [attributes, setAttributes] = useState<Hash>({});
  const [applyTo, setApplyTo] = useState<string>(ON_ITS_OWN);

  useEffect(() => {
    if (!opened) return;
    const first = open[0];
    setApplyTo(first ? String(first.id) : ON_ITS_OWN);
    setAmount(first ? Number(first.amount_due) : 0);
    setType('Check');
    setPaidOn('');
    setNotes('');
    setAttributes({});
    record.reset();
    // Start afresh each time it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const chooseInvoice = (value: string | null) => {
    const next = value ?? ON_ITS_OWN;
    setApplyTo(next);
    const invoice = open.find((i) => String(i.id) === next);
    if (invoice) setAmount(Number(invoice.amount_due));
  };

  const paymentSchema = event.payment_schema;
  const hasSchema = !!paymentSchema && Object.keys(paymentSchema.properties ?? {}).length > 0;

  const save = () =>
    record.mutate(
      {
        registration: registrationId,
        ...(applyTo === ON_ITS_OWN ? { new_invoice: true } : { invoice: Number(applyTo) }),
        payment_type: type,
        paid_on: paidOn || null,
        attributes,
        amount: Number(amount) || 0,
        notes,
      },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Payment recorded' });
          onClose();
        },
      },
    );

  return (
    <Modal opened={opened} onClose={onClose} title="Record a payment">
      <Stack>
        <Select
          label="Apply to"
          data={[
            ...open.map((i) => ({ value: String(i.id), label: invoiceChoiceLabel(i) })),
            { value: ON_ITS_OWN, label: 'On its own (a new “Payment received” invoice)' },
          ]}
          value={applyTo}
          onChange={chooseInvoice}
          allowDeselect={false}
        />
        <Select
          label="Type"
          data={PAYMENT_TYPES}
          value={type}
          onChange={(value) => setType((value as PaymentType | null) ?? 'Check')}
          allowDeselect={false}
        />
        <DateInput
          label="Paid on"
          valueFormat="MM/DD/YYYY"
          value={paidOn || null}
          onChange={(value) => setPaidOn(value ?? '')}
        />
        <NumberInput
          label="Amount"
          prefix="$"
          decimalScale={2}
          value={amount}
          onChange={setAmount}
          min={0}
        />
        <TextInput label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        {hasSchema && (
          <JsonSchemaForm
            schema={paymentSchema}
            formData={attributes}
            onChange={(formData) => setAttributes(formData as Hash)}
          >
            <></>
          </JsonSchemaForm>
        )}
        {record.error && (
          <span role="alert" style={{ color: 'var(--mantine-color-red-filled)' }}>
            {apiErrorMessage(record.error)}
          </span>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={record.isPending}>
            Record payment
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
