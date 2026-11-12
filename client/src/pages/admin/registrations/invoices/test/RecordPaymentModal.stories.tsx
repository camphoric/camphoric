/**
 * Stories for recording a payment (SPEC §8.4, §9.7): with an open invoice it
 * applies to (and fills in what's due), and with nothing open, when it goes on
 * an invoice of its own, and for an event with its own payment types
 * (§15, DR-164). Run `npm run storybook`.
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

export const WithTheEventsOwnTypes: StoryFn = () => (
  <StoryProviders>
    <RecordPaymentModal
      event={
        {
          payment_schema: {},
          payment_types: [
            { value: 'Venmo', label: 'Venmo (@camp)' },
            { value: 'Scholarship', label: 'Scholarship fund' },
          ],
          payment_type_choices: [
            { value: 'Check', label: 'Check', online: false },
            { value: 'Voucher', label: 'Discount or Gifted Credit', online: false },
            { value: 'Venmo', label: 'Venmo (@camp)', online: false },
            { value: 'Scholarship', label: 'Scholarship fund', online: false },
          ],
        } as unknown as ApiEvent
      }
      registrationId={5}
      invoices={[OPEN]}
      opened
      onClose={noop}
    />
  </StoryProviders>
);
