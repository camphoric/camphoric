/**
 * Record a payment against a registration (SPEC §8.4). Captures payment type
 * (Check/PayPal/Card/Voucher), paid-on date, amount, the `payment_schema`
 * dynamic attributes, and notes; persists via POST to payments. Recording a
 * payment changes the registration's derived balance (multi-key invalidation).
 */

import { Button, Group, Modal, NumberInput, Select, Stack, TextInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import type { ApiEvent, AugmentedRegistration, Hash, PaymentType } from 'api-types';
import { JsonSchemaForm } from 'components/form';
import { useState } from 'react';
import { paymentHooks } from 'store/entities';

const PAYMENT_TYPES: PaymentType[] = ['Check', 'PayPal', 'Card', 'Voucher'];

interface AddPaymentModalProps {
  event: ApiEvent;
  registration: AugmentedRegistration;
  opened: boolean;
  onClose: () => void;
}

export function AddPaymentModal({ event, registration, opened, onClose }: AddPaymentModalProps) {
  const create = paymentHooks.useCreate();

  const [type, setType] = useState<PaymentType>('Check');
  const [paidOn, setPaidOn] = useState<string>('');
  const [amount, setAmount] = useState<number | string>(0);
  const [notes, setNotes] = useState('');
  const [attributes, setAttributes] = useState<Hash>({});

  const paymentSchema = event.payment_schema;
  const hasSchema = !!paymentSchema && Object.keys(paymentSchema.properties ?? {}).length > 0;

  const save = () =>
    create.mutate(
      {
        registration: registration.id,
        payment_type: type,
        paid_on: paidOn || null,
        attributes,
        amount: Number(amount) || 0,
        notes,
        deposit: null,
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
        <NumberInput label="Amount" prefix="$" value={amount} onChange={setAmount} min={0} />
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
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={create.isPending}>
            Record payment
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
