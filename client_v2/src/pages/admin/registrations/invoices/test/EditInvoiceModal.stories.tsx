/**
 * Stories for editing an invoice (SPEC §8.4, §9.7): with part of the balance
 * not invoiced yet ("Use the balance"), and a handling fee to work out
 * ("Calculate"). Run `npm run storybook`.
 */

import type { Meta, StoryFn } from '@storybook/react-vite';

import { EditInvoiceModal } from '../EditInvoiceModal';
import { OPEN } from './fixtures';
import { StoryProviders } from './storyProviders';

export default { title: 'Edit Invoice Modal' } satisfies Meta;

const noop = () => undefined;

export const WithUninvoicedBalance: StoryFn = () => (
  <StoryProviders>
    <EditInvoiceModal invoice={OPEN} uninvoicedBalance={450} handlingPercent={2.5} onClose={noop} />
  </StoryProviders>
);

export const NoHandlingPercent: StoryFn = () => (
  <StoryProviders>
    <EditInvoiceModal invoice={OPEN} uninvoicedBalance={0} handlingPercent={0} onClose={noop} />
  </StoryProviders>
);
