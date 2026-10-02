/**
 * One invoice (SPEC §8.4, §9.7): what it's for and where it came from, what it
 * asks (amount plus any handling fee), what's been paid on it and what's due,
 * its memo and internal notes, and its payments, with each refund under the
 * payment it gives money back from. Every role sees all of it; the actions are
 * for those who may take them: Registrars and Admins edit, cancel and reopen
 * it, check a pending PayPal order and refund; only Admins delete (§15, DR-93).
 */

import { ActionIcon, Button, Card, Group, Stack, Table, Text, Title, Tooltip } from '@mantine/core';
import { IconArrowBackUp, IconTrash } from '@tabler/icons-react';
import type { ApiInvoice, ApiPayment, Hash, InvoiceOrigin } from 'api-types';
import type { JSONSchema7 } from 'json-schema';
import { formatMoney } from 'utils/money';

import { InvoiceStatusBadge } from './InvoiceStatusBadge';

const ORIGIN_LABEL: Record<InvoiceOrigin, string> = {
  registration: 'From registration',
  payment_received: 'Payment received',
  admin: 'Created by a registrar',
  migrated: 'Converted',
};

export const originLabel = (invoice: ApiInvoice) =>
  invoice.origin === 'admin' && invoice.created_by_name
    ? `Created by ${invoice.created_by_name}`
    : ORIGIN_LABEL[invoice.origin];

const fieldTitle = (schema: JSONSchema7 | undefined, key: string): string => {
  const prop = schema?.properties?.[key];
  return (typeof prop === 'object' && prop.title) || key;
};

const cellText = (attributes: Hash | null, key: string): string => {
  const value = attributes?.[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
};

const isRefund = (p: ApiPayment) => Number(p.amount) < 0;

export const paymentName = (p: ApiPayment) =>
  isRefund(p)
    ? `${p.payment_type} refund of ${formatMoney(-Number(p.amount))}`
    : `${p.payment_type} payment of ${formatMoney(p.amount)}`;

/** Payments in order, each followed by its refunds; refunds of nothing listed here last. */
function withRefunds(payments: ApiPayment[]): { payment: ApiPayment; nested: boolean }[] {
  const ids = new Set(payments.map((p) => p.id));
  const rows: { payment: ApiPayment; nested: boolean }[] = [];
  payments
    .filter((p) => !isRefund(p) || p.refund_of == null || !ids.has(Number(p.refund_of)))
    .forEach((p) => {
      rows.push({ payment: p, nested: false });
      payments
        .filter((r) => isRefund(r) && r.refund_of != null && Number(r.refund_of) === p.id)
        .forEach((r) => rows.push({ payment: r, nested: true }));
    });
  return rows;
}

export interface InvoiceCardProps {
  invoice: ApiInvoice;
  /** Its live payments and refunds. */
  payments: ApiPayment[];
  paymentSchema?: JSONSchema7;
  canEdit: boolean;
  canDelete: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onReopen?: () => void;
  onCheckPayPal?: () => void;
  checkingPayPal?: boolean;
  onDelete?: () => void;
  onDeletePayment?: (payment: ApiPayment) => void;
  onRefund?: (payment: ApiPayment) => void;
  onRefundDifference?: () => void;
}

export function InvoiceCard({
  invoice,
  payments,
  paymentSchema,
  canEdit,
  canDelete,
  onEdit,
  onCancel,
  onReopen,
  onCheckPayPal,
  checkingPayPal,
  onDelete,
  onDeletePayment,
  onRefund,
  onRefundDifference,
}: InvoiceCardProps) {
  const schemaKeys = Object.keys(paymentSchema?.properties ?? {}).sort();
  const cancelled = invoice.status === 'cancelled';
  const handling = Number(invoice.handling);
  const holdsMoney = Number(invoice.amount_paid) !== 0;

  return (
    <Card withBorder padding="sm" aria-label={`Invoice #${invoice.id}`}>
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Stack gap={0}>
            <Group gap="xs">
              <Title order={5}>
                Invoice #{invoice.id}
                {invoice.description ? `: ${invoice.description}` : ''}
              </Title>
              <InvoiceStatusBadge status={invoice.status} />
            </Group>
            <Text size="xs" c="dimmed">
              {originLabel(invoice)}
              {invoice.payment_type ? ` · to be paid by ${invoice.payment_type}` : ''}
              {invoice.due_on ? ` · due ${invoice.due_on}` : ''}
            </Text>
          </Stack>
          {canEdit && (
            <Group gap="xs" wrap="nowrap">
              {!cancelled && (
                <Button size="compact-sm" variant="light" onClick={onEdit}>
                  Edit
                </Button>
              )}
              {!cancelled && !holdsMoney && (
                <Button size="compact-sm" variant="subtle" color="gray" onClick={onCancel}>
                  Cancel invoice
                </Button>
              )}
              {cancelled && (
                <Button size="compact-sm" variant="light" onClick={onReopen}>
                  Reopen
                </Button>
              )}
              {canDelete && payments.length === 0 && (
                <Tooltip label="Delete invoice">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label={`Delete invoice #${invoice.id}`}
                    onClick={onDelete}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          )}
        </Group>

        <Stack gap={0} maw={360}>
          <Group justify="space-between">
            <Text size="sm">Amount</Text>
            <Text size="sm">{formatMoney(invoice.amount)}</Text>
          </Group>
          {handling !== 0 && (
            <Group justify="space-between">
              <Text size="sm">Electronic payment handling</Text>
              <Text size="sm">{formatMoney(handling)}</Text>
            </Group>
          )}
          <Group justify="space-between">
            <Text size="sm" fw={600}>
              Total
            </Text>
            <Text size="sm" fw={600}>
              {formatMoney(invoice.total)}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Paid</Text>
            <Text size="sm">{formatMoney(invoice.amount_paid)}</Text>
          </Group>
          {invoice.status === 'overpaid' ? (
            <Group justify="space-between">
              <Text size="sm" fw={600}>
                Overpaid
              </Text>
              <Text size="sm" fw={600}>
                {formatMoney(invoice.overpaid)}
              </Text>
            </Group>
          ) : (
            !cancelled && (
              <Group justify="space-between">
                <Text size="sm" fw={600}>
                  Due
                </Text>
                <Text size="sm" fw={600}>
                  {formatMoney(invoice.amount_due)}
                </Text>
              </Group>
            )
          )}
        </Stack>

        {cancelled && invoice.cancel_reason && (
          <Text size="sm" c="dimmed">
            Cancelled: {invoice.cancel_reason}
          </Text>
        )}
        {invoice.memo && (
          <Text size="sm">
            <Text span fw={600}>
              Memo:
            </Text>{' '}
            {invoice.memo}
          </Text>
        )}
        {invoice.notes && (
          <Text size="sm" c="dimmed">
            <Text span fw={600}>
              Notes:
            </Text>{' '}
            {invoice.notes}
          </Text>
        )}

        {invoice.pending_paypal_order_id && (
          <Group gap="xs">
            <Text size="sm" c="orange">
              A PayPal payment (order {invoice.pending_paypal_order_id}) hasn’t been confirmed.
            </Text>
            {canEdit && (
              <Button
                size="compact-sm"
                variant="light"
                color="orange"
                onClick={onCheckPayPal}
                loading={checkingPayPal}
              >
                Check PayPal order
              </Button>
            )}
          </Group>
        )}

        {invoice.status === 'overpaid' && canEdit && onRefundDifference && (
          <Group>
            <Button size="compact-sm" variant="light" color="orange" onClick={onRefundDifference}>
              Refund the difference ({formatMoney(invoice.overpaid)})
            </Button>
          </Group>
        )}

        {payments.length > 0 ? (
          <Table withTableBorder striped fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Type</Table.Th>
                <Table.Th>Paid on</Table.Th>
                <Table.Th>Amount</Table.Th>
                {schemaKeys.map((k) => (
                  <Table.Th key={k}>{fieldTitle(paymentSchema, k)}</Table.Th>
                ))}
                <Table.Th>Notes</Table.Th>
                {canEdit && <Table.Th aria-label="Actions" />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {withRefunds(payments).map(({ payment: p, nested }) => (
                <Table.Tr key={p.id}>
                  <Table.Td pl={nested ? 'lg' : undefined}>
                    {isRefund(p) ? `↳ Refund (${p.payment_type})` : p.payment_type}
                  </Table.Td>
                  <Table.Td>{p.paid_on ?? '—'}</Table.Td>
                  <Table.Td>
                    {formatMoney(p.amount)}
                    {!isRefund(p) && Number(p.refunded ?? 0) > 0 && (
                      <Text span size="xs" c="dimmed">
                        {' '}
                        (refunded {formatMoney(p.refunded ?? 0)})
                      </Text>
                    )}
                  </Table.Td>
                  {schemaKeys.map((k) => (
                    <Table.Td key={k}>{cellText(p.attributes, k)}</Table.Td>
                  ))}
                  <Table.Td>{p.notes}</Table.Td>
                  {canEdit && (
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        {!isRefund(p) && Number(p.refunded ?? 0) < Number(p.amount) && (
                          <Tooltip label="Refund">
                            <ActionIcon
                              variant="subtle"
                              aria-label={`Refund the ${paymentName(p)}`}
                              onClick={() => onRefund?.(p)}
                            >
                              <IconArrowBackUp size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {canDelete && (
                          <Tooltip label="Delete">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              aria-label={`Delete the ${paymentName(p)}`}
                              onClick={() => onDeletePayment?.(p)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text c="dimmed" size="sm">
            No payments on it yet.
          </Text>
        )}
      </Stack>
    </Card>
  );
}
