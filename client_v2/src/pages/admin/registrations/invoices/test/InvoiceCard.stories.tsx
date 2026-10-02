/**
 * Stories for an invoice (SPEC §8.4, §9.7): open, paid by two checks, paid by
 * PayPal with its handling fee and a partial refund, overpaid (with "Refund the
 * difference"), cancelled, with a PayPal payment not yet confirmed, and as a
 * Reporter sees one (everything, no actions). Run `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { InvoiceCard } from '../InvoiceCard';
import {
  CANCELLED,
  OPEN,
  OVERPAID,
  OVERPAID_PAYMENTS,
  PAYPAL_REFUNDED,
  PAYPAL_REFUNDED_PAYMENTS,
  PENDING_PAYPAL,
  TWO_CHECKS,
  TWO_CHECKS_PAYMENTS,
} from './fixtures';

export default { title: 'Invoice Card' } satisfies Meta;

const noop = () => undefined;
const actions = {
  canEdit: true,
  canDelete: true,
  onEdit: noop,
  onCancel: noop,
  onReopen: noop,
  onCheckPayPal: noop,
  onDelete: noop,
  onDeletePayment: noop,
  onRefund: noop,
  onRefundDifference: noop,
};

export const Open: StoryFn = () => (
  <Box p="md" maw={720}>
    <InvoiceCard invoice={OPEN} payments={[]} {...actions} />
  </Box>
);

export const PaidByTwoChecks: StoryFn = () => (
  <Box p="md" maw={720}>
    <InvoiceCard invoice={TWO_CHECKS} payments={TWO_CHECKS_PAYMENTS} {...actions} />
  </Box>
);

export const PayPalWithRefund: StoryFn = () => (
  <Box p="md" maw={720}>
    <InvoiceCard invoice={PAYPAL_REFUNDED} payments={PAYPAL_REFUNDED_PAYMENTS} {...actions} />
  </Box>
);

export const Overpaid: StoryFn = () => (
  <Box p="md" maw={720}>
    <InvoiceCard invoice={OVERPAID} payments={OVERPAID_PAYMENTS} {...actions} />
  </Box>
);

export const Cancelled: StoryFn = () => (
  <Box p="md" maw={720}>
    <InvoiceCard invoice={CANCELLED} payments={[]} {...actions} />
  </Box>
);

export const PayPalNotConfirmed: StoryFn = () => (
  <Box p="md" maw={720}>
    <InvoiceCard invoice={PENDING_PAYPAL} payments={[]} {...actions} />
  </Box>
);

export const AsAReporter: StoryFn = () => (
  <Box p="md" maw={720}>
    <InvoiceCard
      invoice={PAYPAL_REFUNDED}
      payments={PAYPAL_REFUNDED_PAYMENTS}
      canEdit={false}
      canDelete={false}
    />
  </Box>
);
