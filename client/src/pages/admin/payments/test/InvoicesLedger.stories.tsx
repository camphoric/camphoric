/**
 * Stories for the Payments area's invoices ledger (SPEC §8.11): every invoice
 * of a small event — partly paid, paid by PayPal, overpaid and cancelled —
 * with its filters and totals working, and filtered to the overpaid ones. Run
 * `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import type { DataTableState } from 'components/DataTable';
import { useState } from 'react';

import { InvoicesLedger } from '../InvoicesLedger';
import type { InvoiceFilters } from '../ledgers';
import { LEDGER_INVOICES, NAMES } from './fixtures';

export default { title: 'Invoices Ledger' } satisfies Meta;

function Ledger({ initial = {} }: { initial?: InvoiceFilters }) {
  const [filters, setFilters] = useState(initial);
  const [table, setTable] = useState<DataTableState>({
    sorting: [],
    globalFilter: '',
    pageIndex: 0,
  });
  return (
    <Box p="md">
      <InvoicesLedger
        invoices={LEDGER_INVOICES}
        names={NAMES}
        filters={filters}
        onFiltersChange={setFilters}
        tableState={table}
        onTableStateChange={setTable}
        onOpen={() => undefined}
      />
    </Box>
  );
}

export const EveryInvoice: StoryFn = () => <Ledger />;

export const Overpaid: StoryFn = () => <Ledger initial={{ status: 'overpaid' }} />;
