/**
 * Every payment and refund of the event (SPEC §8.11), as a sortable, searchable
 * table — registration, type, date, amount, PayPal transaction id, and the
 * invoice it's on — filtered by payments or refunds, type and date, with what
 * the rows shown received, refunded and net. Unsorted, each refund comes right
 * under the payment it gives money back from. The filters and the table's sort,
 * search and page live in the URL. A row opens its registration.
 */

import { Group, SegmentedControl, Select, Stack, Text } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import type { ApiEventPaymentType, ApiPayment } from 'api-types';
import { DataTable, type DataTableColumnDef, type DataTableState } from 'components/DataTable';
import { useCallback, useMemo } from 'react';
import { formatDay } from 'utils/dates';
import { formatMoney } from 'utils/money';
import { paymentTypeLabel } from 'utils/paymentTypes';

import {
  filterPayments,
  isRefund,
  paymentDay,
  type PaymentFilters,
  paymentTotals,
  withRefundsUnderPayments,
} from './ledgers';
import { LedgerTotals } from './LedgerTotals';

export interface PaymentsLedgerProps {
  payments: ApiPayment[];
  /** How each registration reads, by id. */
  names: Map<number, string>;
  /** The event's own payment types, for how they read (§15, DR-164). */
  paymentTypes?: ApiEventPaymentType[];
  filters: PaymentFilters;
  onFiltersChange: (next: PaymentFilters) => void;
  tableState: DataTableState;
  onTableStateChange: (next: DataTableState) => void;
  onOpen: (payment: ApiPayment) => void;
}

export function PaymentsLedger({
  payments,
  names,
  paymentTypes,
  filters,
  onFiltersChange,
  tableState,
  onTableStateChange,
  onOpen,
}: PaymentsLedgerProps) {
  const nameOf = useCallback(
    (payment: ApiPayment) =>
      names.get(Number(payment.registration)) ?? `Registration ${payment.registration}`,
    [names],
  );
  const typeLabel = useCallback(
    (payment: ApiPayment) => paymentTypeLabel(payment.payment_type, paymentTypes),
    [paymentTypes],
  );

  const shown = useMemo(
    () => withRefundsUnderPayments(filterPayments(payments, filters)),
    [payments, filters],
  );
  const typeOptions = useMemo(
    () =>
      [...new Set(payments.map((p) => p.payment_type))].map((value) => ({
        value,
        label: paymentTypeLabel(value, paymentTypes),
      })),
    [payments, paymentTypes],
  );

  const columns = useMemo<DataTableColumnDef<ApiPayment>[]>(
    () => [
      { id: 'registration', header: 'Registration', accessorFn: nameOf },
      {
        id: 'kind',
        header: 'Kind',
        accessorFn: (p) => (isRefund(p) ? 'Refund' : 'Payment'),
        cell: ({ row }) =>
          isRefund(row.original) ? (
            <Stack gap={0}>
              <Text size="sm" c="orange">
                Refund
              </Text>
              {row.original.refund_of != null && (
                <Text size="xs" c="dimmed">
                  of payment #{row.original.refund_of}
                </Text>
              )}
            </Stack>
          ) : (
            `Payment #${row.original.id}`
          ),
      },
      { id: 'type', header: 'Type', accessorFn: typeLabel },
      {
        id: 'date',
        header: 'Date',
        accessorFn: paymentDay,
        cell: (c) => formatDay(c.getValue<string>()),
      },
      {
        id: 'amount',
        header: 'Amount',
        accessorFn: (p) => Number(p.amount),
        cell: (c) => formatMoney(c.getValue<number>()),
      },
      {
        id: 'paypal',
        header: 'PayPal transaction',
        accessorFn: (p) => p.paypal_transaction_id ?? '',
        cell: (c) => c.getValue<string>() || '—',
      },
      {
        id: 'invoice',
        header: 'Invoice',
        accessorFn: (p) => Number(p.invoice),
        cell: (c) => `#${c.getValue<number>()}`,
      },
    ],
    [nameOf, typeLabel],
  );

  const set = (patch: PaymentFilters) => onFiltersChange({ ...filters, ...patch });

  return (
    <>
      <Group gap="sm" mb="sm" align="flex-end" wrap="wrap">
        <SegmentedControl
          aria-label="Payments or refunds"
          value={filters.kind ?? 'all'}
          onChange={(value) => set({ kind: value === 'all' ? undefined : value })}
          data={[
            { value: 'all', label: 'All' },
            { value: 'payment', label: 'Payments' },
            { value: 'refund', label: 'Refunds' },
          ]}
        />
        <Select
          label="Type"
          placeholder="Any"
          data={typeOptions}
          value={filters.type ?? null}
          onChange={(value) => set({ type: value ?? undefined })}
          clearable
          w={190}
        />
        <DateInput
          label="From"
          valueFormat="MM/DD/YYYY"
          value={filters.from ?? null}
          onChange={(value) => set({ from: value ?? undefined })}
          clearable
          w={150}
        />
        <DateInput
          label="To"
          valueFormat="MM/DD/YYYY"
          value={filters.to ?? null}
          onChange={(value) => set({ to: value ?? undefined })}
          clearable
          w={150}
        />
      </Group>
      <DataTable
        data={shown}
        columns={columns}
        searchKeys={[
          nameOf,
          typeLabel,
          (p) => p.paypal_transaction_id ?? '',
          (p) => `#${p.invoice}`,
        ]}
        searchPlaceholder="Search payments…"
        onRowClick={onOpen}
        emptyMessage="No payments match."
        state={tableState}
        onStateChange={onTableStateChange}
        footer={(rows) => {
          const totals = paymentTotals(rows);
          return (
            <LedgerTotals
              count={rows.length}
              totals={[
                { label: 'Received', amount: totals.received },
                { label: 'Refunded', amount: totals.refunded },
                { label: 'Net', amount: totals.net },
              ]}
            />
          );
        }}
      />
    </>
  );
}
