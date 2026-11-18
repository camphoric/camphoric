/**
 * Every invoice of the event (SPEC §8.11), as a sortable, searchable table —
 * registration, description, origin, how it's to be paid, due date, amount,
 * paid, due or overpaid, and status — filtered by status, origin, how it's to
 * be paid and due date, with the totals of the rows shown. The filters and the
 * table's sort, search and page live in the URL. A row opens its registration.
 */

import { Group, Select, Text } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import type { ApiEventPaymentType, ApiInvoice } from 'api-types';
import { DataTable, type DataTableColumnDef, type DataTableState } from 'components/DataTable';
import {
  InvoiceStatusBadge,
  ORIGIN_LABEL,
  originLabel,
  STATUS_LABEL,
} from 'pages/admin/registrations/invoices';
import { useCallback, useMemo } from 'react';
import { formatDay } from 'utils/dates';
import { formatMoney } from 'utils/money';
import { paymentTypeLabel } from 'utils/paymentTypes';

import { filterInvoices, type InvoiceFilters, invoiceTotals } from './ledgers';
import { LedgerTotals } from './LedgerTotals';

const options = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

export interface InvoicesLedgerProps {
  invoices: ApiInvoice[];
  /** How each registration reads, by id. */
  names: Map<number, string>;
  /** The event's own payment types, for how they read (§15, DR-164). */
  paymentTypes?: ApiEventPaymentType[];
  filters: InvoiceFilters;
  onFiltersChange: (next: InvoiceFilters) => void;
  tableState: DataTableState;
  onTableStateChange: (next: DataTableState) => void;
  onOpen: (invoice: ApiInvoice) => void;
}

export function InvoicesLedger({
  invoices,
  names,
  paymentTypes,
  filters,
  onFiltersChange,
  tableState,
  onTableStateChange,
  onOpen,
}: InvoicesLedgerProps) {
  const nameOf = useCallback(
    (invoice: ApiInvoice) =>
      names.get(Number(invoice.registration)) ?? `Registration ${invoice.registration}`,
    [names],
  );
  const typeLabel = useCallback(
    (invoice: ApiInvoice) =>
      invoice.payment_type ? paymentTypeLabel(invoice.payment_type, paymentTypes) : '',
    [paymentTypes],
  );

  const shown = useMemo(() => filterInvoices(invoices, filters), [invoices, filters]);
  const typeOptions = useMemo(
    () =>
      [...new Set(invoices.map((i) => i.payment_type).filter((t): t is string => !!t))].map(
        (value) => ({ value, label: paymentTypeLabel(value, paymentTypes) }),
      ),
    [invoices, paymentTypes],
  );

  const columns = useMemo<DataTableColumnDef<ApiInvoice>[]>(
    () => [
      {
        id: 'id',
        header: 'Invoice',
        accessorFn: (i) => i.id,
        cell: (c) => `#${c.getValue<number>()}`,
      },
      { id: 'registration', header: 'Registration', accessorFn: nameOf },
      { accessorKey: 'description', header: 'Description' },
      { id: 'origin', header: 'Origin', accessorFn: originLabel },
      { id: 'type', header: 'To be paid by', accessorFn: typeLabel },
      {
        id: 'due_on',
        header: 'Due',
        accessorFn: (i) => i.due_on ?? '',
        cell: (c) => (c.getValue<string>() ? formatDay(c.getValue<string>()) : '—'),
      },
      {
        id: 'total',
        header: 'Amount',
        accessorFn: (i) => Number(i.total),
        cell: (c) => formatMoney(c.getValue<number>()),
      },
      {
        id: 'paid',
        header: 'Paid',
        accessorFn: (i) => Number(i.amount_paid),
        cell: (c) => formatMoney(c.getValue<number>()),
      },
      {
        // What's still due, or (negative) what was overpaid.
        id: 'due',
        header: 'Due / overpaid',
        accessorFn: (i) => Number(i.amount_due) - Number(i.overpaid),
        cell: ({ row }) =>
          Number(row.original.overpaid) > 0 ? (
            <Text size="sm" c="orange">
              {formatMoney(row.original.overpaid)} over
            </Text>
          ) : (
            formatMoney(row.original.amount_due)
          ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (i) => STATUS_LABEL[i.status],
        cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} />,
      },
    ],
    [nameOf, typeLabel],
  );

  const set = (patch: InvoiceFilters) => onFiltersChange({ ...filters, ...patch });

  return (
    <>
      <Group gap="sm" mb="sm" align="flex-end" wrap="wrap">
        <Select
          label="Status"
          placeholder="Any"
          data={options(STATUS_LABEL)}
          value={filters.status ?? null}
          onChange={(value) => set({ status: value ?? undefined })}
          clearable
          w={170}
        />
        <Select
          label="Origin"
          placeholder="Any"
          data={options(ORIGIN_LABEL)}
          value={filters.origin ?? null}
          onChange={(value) => set({ origin: value ?? undefined })}
          clearable
          w={200}
        />
        <Select
          label="To be paid by"
          placeholder="Any"
          data={typeOptions}
          value={filters.type ?? null}
          onChange={(value) => set({ type: value ?? undefined })}
          clearable
          w={170}
        />
        <DateInput
          label="Due from"
          valueFormat="MM/DD/YYYY"
          value={filters.dueFrom ?? null}
          onChange={(value) => set({ dueFrom: value ?? undefined })}
          clearable
          w={150}
        />
        <DateInput
          label="Due to"
          valueFormat="MM/DD/YYYY"
          value={filters.dueTo ?? null}
          onChange={(value) => set({ dueTo: value ?? undefined })}
          clearable
          w={150}
        />
      </Group>
      <DataTable
        data={shown}
        columns={columns}
        searchKeys={[nameOf, 'description', (i) => `#${i.id}`]}
        searchPlaceholder="Search invoices…"
        onRowClick={onOpen}
        emptyMessage="No invoices match."
        state={tableState}
        onStateChange={onTableStateChange}
        footer={(rows) => {
          const totals = invoiceTotals(rows);
          return (
            <LedgerTotals
              count={rows.length}
              totals={[
                { label: 'Asked', amount: totals.asked },
                { label: 'Paid', amount: totals.paid },
                { label: 'Due', amount: totals.due },
                { label: 'Overpaid', amount: totals.overpaid },
              ]}
            />
          );
        }}
      />
    </>
  );
}
