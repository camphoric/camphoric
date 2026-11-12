/**
 * Stories for giving money back (SPEC §8.4, §9.7; §15, DR-94): refunding a
 * PayPal payment through PayPal, recording a check mailed back, and "Refund
 * the difference" on an overpaid invoice, and refunding a payment by a type
 * its event has since dropped (§15, DR-164). Run `npm run storybook`.
 */

import type { Meta, StoryFn } from '@storybook/react-vite';

import { RefundModal } from '../RefundModal';
import {
  OVERPAID,
  OVERPAID_PAYMENTS,
  PAID_BY_VENMO,
  PAID_BY_VENMO_PAYMENTS,
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

export const ByATypeTheEventDropped: StoryFn = () => (
  <StoryProviders>
    <RefundModal
      target={{ invoice: PAID_BY_VENMO, payment: PAID_BY_VENMO_PAYMENTS[1], amount: 50 }}
      payments={PAID_BY_VENMO_PAYMENTS}
      event={{
        payment_types: [{ value: 'Venmo', label: 'Venmo (@camp)' }],
        payment_type_choices: [
          { value: 'Check', label: 'Check', online: false },
          { value: 'Voucher', label: 'Discount or Gifted Credit', online: false },
          { value: 'Venmo', label: 'Venmo (@camp)', online: false },
        ],
      }}
      onClose={noop}
    />
  </StoryProviders>
);
