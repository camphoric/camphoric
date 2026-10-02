/**
 * Stories for what the payment page says when a payment didn't go through
 * (SPEC §7.2; §15, DR-91): cancelled or declined, and PayPal's answer lost.
 * Run `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { PaymentNotFinished } from '../PaymentNotFinished';

export default { title: 'Payment Not Finished' } satisfies Meta;

const noop = () => undefined;

export const Cancelled: StoryFn = () => (
  <Box p="md" maw={600}>
    <PaymentNotFinished amountDue={550} onFinish={noop} />
  </Box>
);

export const Declined: StoryFn = () => (
  <Box p="md" maw={600}>
    <PaymentNotFinished
      amountDue={550}
      reason="PayPal declined this payment. Please try another way to pay."
      onFinish={noop}
    />
  </Box>
);

export const OutcomeUnknown: StoryFn = () => (
  <Box p="md" maw={600}>
    <PaymentNotFinished amountDue={550} unknown onFinish={noop} />
  </Box>
);
