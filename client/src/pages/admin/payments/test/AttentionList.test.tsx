import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, within } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { AttentionList } from '../AttentionList';
import { ATTENTION_ITEMS, NOT_INVOICED, REFUND_THROUGH_PAYPAL } from './fixtures';

describe('AttentionList', () => {
  it('counts each kind at a glance and lists its items under it', () => {
    renderWithProviders(<AttentionList items={ATTENTION_ITEMS} canAct onOpen={vi.fn()} />);
    const counts = screen.getByLabelText('Needs attention, by kind');
    expect(within(counts).getByText('Refund due: 2')).toBeInTheDocument();
    expect(within(counts).getByText('Online payment not finished: 2')).toBeInTheDocument();

    const refunds = screen.getByRole('region', { name: 'Refund due' });
    expect(within(refunds).getByText('Lee Beta')).toBeInTheDocument();
    expect(within(refunds).getByText('$75.00')).toBeInTheDocument();
    expect(within(refunds).getByRole('button', { name: 'Refund through PayPal' })).toBeVisible();
    expect(within(refunds).getByRole('button', { name: 'Record a refund' })).toBeVisible();
  });

  it('opens the item it’s asked to', async () => {
    const onOpen = vi.fn();
    renderWithProviders(<AttentionList items={[NOT_INVOICED]} canAct onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: 'Make an invoice' }));
    expect(onOpen).toHaveBeenCalledWith(NOT_INVOICED);
  });

  it('lets someone who can’t act only look', () => {
    renderWithProviders(
      <AttentionList items={[REFUND_THROUGH_PAYPAL]} canAct={false} onOpen={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'View registration' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refund through PayPal' })).toBeNull();
  });

  it('says when nothing needs attention', () => {
    renderWithProviders(<AttentionList items={[]} canAct onOpen={vi.fn()} />);
    expect(screen.getByText(/Nothing needs attention/)).toBeInTheDocument();
  });
});
