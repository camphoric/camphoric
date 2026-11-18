/**
 * Stories for the Payments area's totals (SPEC §8.11; §15, DR-173): an event
 * with credits, promo discounts, cancellation fees, several payment types and
 * PayPal's fees; and one with nothing yet. Run `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { PaymentsTotals } from '../PaymentsTotals';
import { EMPTY_TOTALS, TOTALS } from './fixtures';

export default { title: 'Payments Totals' } satisfies Meta;

export const Totals: StoryFn = () => (
  <Box p="md">
    <PaymentsTotals totals={TOTALS} />
  </Box>
);

export const NothingYet: StoryFn = () => (
  <Box p="md">
    <PaymentsTotals totals={EMPTY_TOTALS} />
  </Box>
);
