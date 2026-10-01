/**
 * Review fees and manage payments for a registration (SPEC §8.4): the fee
 * breakdown from `server_pricing_results` (labels from the pricing-logic vars),
 * Total Owed / Total Payments / Balance Due, the payment history (type, date,
 * amount, payment_schema fields, notes), and recording a payment. Registrars and
 * Admins can override the registration's own price lines (its donation, the
 * handling fee; DR-56). Registrars and
 * Admins can also delete a payment (after confirming) and restore a deleted one
 * (§15, DR-55).
 */

import { ActionIcon, Button, Group, Stack, Table, Text, Title, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';
import type { ApiEvent, ApiPayment, AugmentedRegistration, Hash } from 'api-types';
import { confirmDelete } from 'components/ConfirmDelete';
import { CanEdit, usePermissions } from 'hooks/permissions';
import type { JSONSchema7 } from 'json-schema';
import { PriceLines } from 'pages/admin/pricing';
import { useState } from 'react';
import { useDeletedPayments, useRestore } from 'store/deletes';
import { paymentHooks } from 'store/entities';
import { formatMoney } from 'utils/money';

import { AddPaymentModal } from './AddPaymentModal';

const fieldTitle = (schema: JSONSchema7 | undefined, key: string): string => {
  const prop = schema?.properties?.[key];
  return (typeof prop === 'object' && prop.title) || key;
};

const cellText = (attributes: Hash | null, key: string): string => {
  const value = attributes?.[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
};

interface RegistrationPaymentsProps {
  event: ApiEvent;
  registration: AugmentedRegistration;
}

export function RegistrationPayments({ event, registration }: RegistrationPaymentsProps) {
  const { data: payments } = paymentHooks.useList({ registration: registration.id });
  const { canEdit } = usePermissions();
  const { data: deleted } = useDeletedPayments({ registration: registration.id }, canEdit);
  const del = paymentHooks.useDelete();
  const restore = useRestore('payments');
  const [addOpen, setAddOpen] = useState(false);

  const paymentName = (p: ApiPayment) => `${p.payment_type} payment of ${formatMoney(p.amount)}`;

  const confirmDeletePayment = (p: ApiPayment) =>
    confirmDelete({
      path: 'payments',
      id: p.id,
      title: 'Delete payment',
      message: <>Delete the {paymentName(p)}?</>,
      onConfirm: () => del.mutate({ id: p.id }),
    });

  const schemaKeys = Object.keys(event.payment_schema?.properties ?? {}).sort();

  return (
    <Stack>
      <Title order={4}>Fees &amp; payments</Title>
      <Text size="sm" c="dimmed">
        Payment type at registration: {registration.payment_type || 'None'}
      </Text>

      <PriceLines
        event={event}
        results={registration.server_pricing_results}
        logics={[event.registration_pricing_logic, event.camper_pricing_logic]}
        registrationId={registration.id}
        promoLabel={registration.promo?.label}
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
              {canEdit && <Table.Th aria-label="Actions" />}
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
                {canEdit && (
                  <Table.Td>
                    <Tooltip label="Delete">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={`Delete the ${paymentName(p)}`}
                        onClick={() => confirmDeletePayment(p)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text c="dimmed" size="sm">
          No payments yet.
        </Text>
      )}

      <CanEdit>
        <Group>
          <Button variant="light" onClick={() => setAddOpen(true)}>
            Add payment
          </Button>
        </Group>
      </CanEdit>

      {canEdit && deleted && deleted.length > 0 && (
        <Stack gap="xs">
          <Text fw={600}>Deleted payments</Text>
          {deleted.map((p) => (
            <Group key={p.id} justify="space-between" wrap="nowrap">
              <Text size="sm">
                {paymentName(p)}
                {p.paid_on ? ` (paid ${p.paid_on})` : ''} — deleted{' '}
                {new Date(p.deleted_at).toLocaleString()}
                {p.deleted_by ? ` by ${p.deleted_by.name}` : ''}
              </Text>
              <Button
                size="compact-sm"
                variant="light"
                loading={restore.isPending && restore.variables === p.id}
                onClick={() =>
                  restore.mutate(p.id, {
                    onSuccess: () =>
                      notifications.show({ color: 'green', message: 'Payment restored' }),
                  })
                }
              >
                Restore
              </Button>
            </Group>
          ))}
        </Stack>
      )}

      <AddPaymentModal
        event={event}
        registration={registration}
        opened={addOpen}
        onClose={() => setAddOpen(false)}
      />
    </Stack>
  );
}
