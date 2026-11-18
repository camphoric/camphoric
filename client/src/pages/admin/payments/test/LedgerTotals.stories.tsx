/**
 * Stories for a ledger's totals of the rows shown (SPEC §8.11): payments and
 * refunds, and invoices. Run `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { LedgerTotals } from '../LedgerTotals';

export default { title: 'Ledger Totals' } satisfies Meta;

export const PaymentsAndRefunds: StoryFn = () => (
  <Box p="md">
    <LedgerTotals
      count={4}
      totals={[
        { label: 'Received', amount: 705 },
        { label: 'Refunded', amount: 75 },
        { label: 'Net', amount: 630 },
      ]}
    />
  </Box>
);

export const Invoices: StoryFn = () => (
  <Box p="md">
    <LedgerTotals
      count={4}
      totals={[
        { label: 'Asked', amount: 1335 },
        { label: 'Paid', amount: 630 },
        { label: 'Due', amount: 725 },
        { label: 'Overpaid', amount: 20 },
      ]}
    />
  </Box>
);
