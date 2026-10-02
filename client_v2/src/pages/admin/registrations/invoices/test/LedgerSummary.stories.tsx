/**
 * Stories for a registration's ledger (SPEC §9.7): with a handling fee and a
 * balance due, paid in full, a refund due, and part of the balance not on an
 * invoice yet. Run `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { LedgerSummary } from '../LedgerSummary';
import { LEDGER } from './fixtures';

export default { title: 'Ledger Summary' } satisfies Meta;

export const BalanceDue: StoryFn = () => (
  <Box p="md">
    <LedgerSummary ledger={LEDGER} />
  </Box>
);

export const PaidInFull: StoryFn = () => (
  <Box p="md">
    <LedgerSummary ledger={{ ...LEDGER, total_paid: 1025, balance: 0 }} />
  </Box>
);

export const RefundDue: StoryFn = () => (
  <Box p="md">
    <LedgerSummary ledger={{ ...LEDGER, total_paid: 1075, balance: -50 }} />
  </Box>
);

export const NotAllInvoiced: StoryFn = () => (
  <Box p="md">
    <LedgerSummary
      ledger={{
        total_owed: 1000,
        total_paid: 500,
        balance: 500,
        handling_charges: 0,
        uninvoiced_balance: 500,
      }}
    />
  </Box>
);
