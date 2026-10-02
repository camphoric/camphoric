/**
 * Stories for recording a payment (SPEC §8.4, §9.7): with an open invoice it
 * applies to (and fills in what's due), and with nothing open, when it goes on
 * an invoice of its own. Run `npm run storybook`.
 */

import type { Meta, StoryFn } from '@storybook/react-vite';
import type { ApiEvent } from 'api-types';

import { RecordPaymentModal } from '../RecordPaymentModal';
import { OPEN, PAYPAL_REFUNDED, TWO_CHECKS } from './fixtures';
import { StoryProviders } from './storyProviders';

export default { title: 'Record Payment Modal' } satisfies Meta;

const event = { payment_schema: {} } as unknown as ApiEvent;
const noop = () => undefined;

export const ToAnOpenInvoice: StoryFn = () => (
  <StoryProviders>
    <RecordPaymentModal
      event={event}
      registrationId={5}
      invoices={[OPEN, PAYPAL_REFUNDED]}
      opened
      onClose={noop}
    />
  </StoryProviders>
);

export const NothingOpen: StoryFn = () => (
  <StoryProviders>
    <RecordPaymentModal
      event={event}
      registrationId={5}
      invoices={[TWO_CHECKS]}
      opened
      onClose={noop}
    />
  </StoryProviders>
);
