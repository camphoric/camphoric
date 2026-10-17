/**
 * Stories for giving money back (SPEC §8.4, §9.7; §15, DR-94): refunding a
 * PayPal payment through PayPal, recording a check mailed back, and "Refund
 * the difference" on an overpaid invoice. Run `npm run storybook`.
 */

import type { Meta, StoryFn } from '@storybook/react-vite';

import { RefundModal } from '../RefundModal';
import {
  OVERPAID,
  OVERPAID_PAYMENTS,
  PAYPAL_REFUNDED,
  PAYPAL_REFUNDED_PAYMENTS,
  TWO_CHECKS,
  TWO_CHECKS_PAYMENTS,
} from './fixtures';
import { StoryProviders } from './storyProviders';

export default { title: 'Refund Modal' } satisfies Meta;

const noop = () => undefined;

export const ThroughPayPal: StoryFn = () => (
  <StoryProviders>
    <RefundModal
      target={{ invoice: PAYPAL_REFUNDED, payment: PAYPAL_REFUNDED_PAYMENTS[0], amount: 925 }}
      payments={PAYPAL_REFUNDED_PAYMENTS}
      onClose={noop}
    />
  </StoryProviders>
);

export const ACheckMailedBack: StoryFn = () => (
  <StoryProviders>
    <RefundModal
      target={{ invoice: TWO_CHECKS, payment: TWO_CHECKS_PAYMENTS[1], amount: 100 }}
      payments={TWO_CHECKS_PAYMENTS}
      onClose={noop}
    />
  </StoryProviders>
);

export const TheDifference: StoryFn = () => (
  <StoryProviders>
    <RefundModal
      target={{ invoice: OVERPAID, amount: 50 }}
      payments={OVERPAID_PAYMENTS}
      onClose={noop}
    />
  </StoryProviders>
);
