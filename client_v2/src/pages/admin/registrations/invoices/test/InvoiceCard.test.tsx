import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, within } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { InvoiceCard } from '../InvoiceCard';
import {
  OVERPAID,
  OVERPAID_PAYMENTS,
  PAYPAL_REFUNDED,
  PAYPAL_REFUNDED_PAYMENTS,
  PENDING_PAYPAL,
  TWO_CHECKS,
  TWO_CHECKS_PAYMENTS,
} from './fixtures';

describe('InvoiceCard', () => {
  it('shows what it asks, its handling fee, and each refund under its payment', () => {
    renderWithProviders(
      <InvoiceCard
        invoice={PAYPAL_REFUNDED}
        payments={PAYPAL_REFUNDED_PAYMENTS}
        canEdit={false}
        canDelete={false}
      />,
    );
    expect(screen.getByText('Invoice #2: Full Payment')).toBeInTheDocument();
    expect(screen.getByText('Electronic payment handling')).toBeInTheDocument();
    // The total, and the PayPal payment that paid it.
    expect(screen.getAllByText('$1,025.00')).toHaveLength(2);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('PayPal')).toBeInTheDocument();
    expect(within(rows[0]).getByText(/refunded \$100\.00/)).toBeInTheDocument();
    expect(within(rows[1]).getByText('↳ Refund (PayPal)')).toBeInTheDocument();
    // A Reporter sees it all, but no actions.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('lets a Registrar refund and edit, but not delete or cancel while it holds money', async () => {
    const onRefund = vi.fn();
    renderWithProviders(
      <InvoiceCard
        invoice={TWO_CHECKS}
        payments={TWO_CHECKS_PAYMENTS}
        canEdit
        canDelete={false}
        onRefund={onRefund}
      />,
    );
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel invoice' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();
    expect(screen.getByText(/Second check came a week later/)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Refund the Check payment of $100.00' }),
    );
    expect(onRefund).toHaveBeenCalledWith(TWO_CHECKS_PAYMENTS[1]);
  });

  it('lets an Admin delete a payment', async () => {
    const onDeletePayment = vi.fn();
    renderWithProviders(
      <InvoiceCard
        invoice={TWO_CHECKS}
        payments={TWO_CHECKS_PAYMENTS}
        canEdit
        canDelete
        onDeletePayment={onDeletePayment}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete the Check payment of $450.00' }),
    );
    expect(onDeletePayment).toHaveBeenCalledWith(TWO_CHECKS_PAYMENTS[0]);
  });

  it('offers to refund the difference when it’s overpaid', async () => {
    const onRefundDifference = vi.fn();
    renderWithProviders(
      <InvoiceCard
        invoice={OVERPAID}
        payments={OVERPAID_PAYMENTS}
        canEdit
        canDelete={false}
        onRefundDifference={onRefundDifference}
      />,
    );
    expect(screen.getByText(/Created by Reggie/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Refund the difference ($50.00)' }));
    expect(onRefundDifference).toHaveBeenCalled();
  });

  it('offers to check a PayPal order that wasn’t confirmed, and to cancel or delete', async () => {
    const onCheckPayPal = vi.fn();
    const onCancel = vi.fn();
    renderWithProviders(
      <InvoiceCard
        invoice={PENDING_PAYPAL}
        payments={[]}
        canEdit
        canDelete
        onCheckPayPal={onCheckPayPal}
        onCancel={onCancel}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Check PayPal order' }));
    expect(onCheckPayPal).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel invoice' }));
    expect(onCancel).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete invoice #5' })).toBeInTheDocument();
  });
});
