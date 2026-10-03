/**
 * Stories for making an invoice by hand (SPEC §8.4, §9.7; §15, DR-96): for the
 * balance no invoice asks for yet, and with everything already invoiced. Run
 * `npm run storybook`.
 */

import type { Meta, StoryFn } from '@storybook/react-vite';

import { NewInvoiceModal } from '../NewInvoiceModal';
import { StoryProviders } from './storyProviders';

export default { title: 'New Invoice Modal' } satisfies Meta;

const noop = () => undefined;

export const ForTheBalance: StoryFn = () => (
  <StoryProviders>
    <NewInvoiceModal registrationId={5} uninvoicedBalance={1425} opened onClose={noop} />
  </StoryProviders>
);

export const AllInvoiced: StoryFn = () => (
  <StoryProviders>
    <NewInvoiceModal registrationId={5} uninvoicedBalance={0} opened onClose={noop} />
  </StoryProviders>
);
