/**
 * What an invoice's pay page shows (SPEC §9.7; §15, DR-95): the event, who it's
 * for (campers' first names and initials), the memo, what it asks, what's been
 * paid and what's due, and its status. Presentational.
 */

import { Badge, Group, Stack, Table, Text, Title } from '@mantine/core';
import type { ApiInvoicePay, InvoiceStatus } from 'api-types';
import { formatMoney } from 'utils/money';

const STATUS: Record<InvoiceStatus, { label: string; color: string }> = {
  open: { label: 'Due', color: 'red' },
  partially_paid: { label: 'Partly paid', color: 'yellow' },
  paid: { label: 'Paid', color: 'green' },
  overpaid: { label: 'Paid', color: 'green' },
  cancelled: { label: 'Cancelled', color: 'gray' },
};

export function InvoiceSummary({ page }: { page: ApiInvoicePay }) {
  const { event, invoice, campers } = page;
  const status = STATUS[invoice.status];
  const handling = Number(invoice.handling);
  const paid = Number(invoice.amount_paid);
  const due = Number(invoice.amount_due);
  const dueOn = invoice.due_on
    ? new Date(`${invoice.due_on}T00:00:00`).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start">
        <Stack gap={0}>
          <Title order={2}>{event.name}</Title>
          <Text c="dimmed">
            Invoice #{invoice.id}
            {campers.length > 0 ? ` · ${campers.join(', ')}` : ''}
          </Text>
        </Stack>
        <Badge color={status.color} size="lg" variant="light">
          {status.label}
        </Badge>
      </Group>

      {invoice.memo && <Text style={{ whiteSpace: 'pre-line' }}>{invoice.memo}</Text>}

      <Table withRowBorders={false} w="auto" aria-label="Invoice">
        <Table.Tbody>
          <Table.Tr>
            <Table.Td>{invoice.description || 'Registration'}</Table.Td>
            <Table.Td ta="right">{formatMoney(invoice.amount)}</Table.Td>
          </Table.Tr>
          {handling !== 0 && (
            <Table.Tr>
              <Table.Td>Electronic payment handling</Table.Td>
              <Table.Td ta="right">{formatMoney(handling)}</Table.Td>
            </Table.Tr>
          )}
          {paid !== 0 && (
            <Table.Tr>
              <Table.Td>Paid</Table.Td>
              <Table.Td ta="right">{formatMoney(-paid)}</Table.Td>
            </Table.Tr>
          )}
          {invoice.status !== 'cancelled' && (
            <Table.Tr>
              <Table.Td fw={700}>Due{dueOn ? ` by ${dueOn}` : ''}</Table.Td>
              <Table.Td ta="right" fw={700}>
                {formatMoney(due)}
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
