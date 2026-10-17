/**
 * Stories for what an invoice's pay page shows (SPEC §9.7; §15, DR-95): due,
 * paid (with the handling fee charged online), and cancelled. Run
 * `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { InvoiceSummary } from '../InvoiceSummary';
import { CANCELLED, DUE, PAID } from './fixtures';

export default { title: 'Invoice Summary' } satisfies Meta;

export const Due: StoryFn = () => (
  <Box p="md" maw={640}>
    <InvoiceSummary page={DUE} />
  </Box>
);

export const Paid: StoryFn = () => (
  <Box p="md" maw={640}>
    <InvoiceSummary page={PAID} />
  </Box>
);

export const Cancelled: StoryFn = () => (
  <Box p="md" maw={640}>
    <InvoiceSummary page={CANCELLED} />
  </Box>
);
