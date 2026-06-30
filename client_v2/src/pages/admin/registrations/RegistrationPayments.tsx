/**
 * Review fees and manage payments for a registration (SPEC §8.4): the fee
 * breakdown from `server_pricing_results` (labels from the pricing-logic vars),
 * Total Owed / Total Payments / Balance Due, the payment history (type, date,
 * amount, payment_schema fields, notes), and recording a payment.
 */

import { Button, Group, Stack, Table, Text, Title } from '@mantine/core';
import type { ApiEvent, AugmentedRegistration, Hash } from 'api-types';
import type { JSONSchema7 } from 'json-schema';
import { useState } from 'react';
import { paymentHooks } from 'store/entities';
import { formatMoney } from 'utils/money';

import { FeeBreakdown } from '../FeeBreakdown';
import { AddPaymentModal } from './AddPaymentModal';

const fieldTitle = (schema: JSONSchema7 | undefined, key: string): string => {
  const prop = schema?.properties?.[key];
  return (typeof prop === 'object' && prop.title) || key;
};

const cellText = (attributes: Hash, key: string): string => {
  const value = attributes[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
};

interface RegistrationPaymentsProps {
  event: ApiEvent;
  registration: AugmentedRegistration;
}

export function RegistrationPayments({ event, registration }: RegistrationPaymentsProps) {
  const { data: payments } = paymentHooks.useList({ registration: registration.id });
  const [addOpen, setAddOpen] = useState(false);

  const schemaKeys = Object.keys(event.payment_schema?.properties ?? {}).sort();

  return (
    <Stack>
      <Title order={4}>Fees &amp; payments</Title>
      <Text size="sm" c="dimmed">
        Payment type at registration: {registration.payment_type || 'None'}
      </Text>

      <FeeBreakdown
        results={registration.server_pricing_results}
        logics={[event.registration_pricing_logic, event.camper_pricing_logic]}
      />

      <Stack gap={2} maw={360}>
        <Group justify="space-between">
          <Text fw={600}>Total owed</Text>
          <Text fw={600}>{formatMoney(registration.total_owed)}</Text>
        </Group>
        <Group justify="space-between">
          <Text>Total payments</Text>
          <Text>{formatMoney(registration.total_payments)}</Text>
        </Group>
        <Group justify="space-between">
          <Text fw={600}>Balance due</Text>
          <Text fw={600}>{formatMoney(registration.total_balance)}</Text>
        </Group>
      </Stack>

      <Text fw={600}>Payment history</Text>
      {payments && payments.length > 0 ? (
        <Table withTableBorder withColumnBorders striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Paid on</Table.Th>
              <Table.Th>Amount</Table.Th>
              {schemaKeys.map((k) => (
                <Table.Th key={k}>{fieldTitle(event.payment_schema, k)}</Table.Th>
              ))}
              <Table.Th>Notes</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {payments.map((p) => (
              <Table.Tr key={p.id}>
                <Table.Td>{p.payment_type}</Table.Td>
                <Table.Td>{p.paid_on ?? '—'}</Table.Td>
                <Table.Td>{formatMoney(p.amount)}</Table.Td>
                {schemaKeys.map((k) => (
                  <Table.Td key={k}>{cellText(p.attributes, k)}</Table.Td>
                ))}
                <Table.Td>{p.notes}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text c="dimmed" size="sm">
          No payments yet.
        </Text>
      )}

      <Group>
        <Button variant="light" onClick={() => setAddOpen(true)}>
          Add payment
        </Button>
      </Group>

      <AddPaymentModal
        event={event}
        registration={registration}
        opened={addOpen}
        onClose={() => setAddOpen(false)}
      />
    </Stack>
  );
}
