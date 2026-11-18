/**
 * Stories for the Payments area's payments ledger (SPEC §8.11): checks and a
 * PayPal payment with its partial refund under it, with the filters and totals
 * working, and filtered to refunds. Run `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import type { DataTableState } from 'components/DataTable';
import { useState } from 'react';

import type { PaymentFilters } from '../ledgers';
import { PaymentsLedger } from '../PaymentsLedger';
import { LEDGER_PAYMENTS, NAMES } from './fixtures';

export default { title: 'Payments Ledger' } satisfies Meta;

function Ledger({ initial = {} }: { initial?: PaymentFilters }) {
  const [filters, setFilters] = useState(initial);
  const [table, setTable] = useState<DataTableState>({
    sorting: [],
    globalFilter: '',
    pageIndex: 0,
  });
  return (
    <Box p="md">
      <PaymentsLedger
        payments={LEDGER_PAYMENTS}
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

export const EveryPayment: StoryFn = () => <Ledger />;

export const Refunds: StoryFn = () => <Ledger initial={{ kind: 'refund' }} />;
