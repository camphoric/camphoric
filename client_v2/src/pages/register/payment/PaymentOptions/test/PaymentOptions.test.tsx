import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { PaymentOptions } from '../PaymentOptions';
import { DEPOSIT_OPTIONS, SINGLE_OPTION } from './fixtures';

describe('PaymentOptions', () => {
  it('shows the chosen option by check and online, with its fee', () => {
    renderWithProviders(
      <PaymentOptions
        paymentOptions={DEPOSIT_OPTIONS}
        selected="50% Deposit"
        onSelect={() => undefined}
        online
        handlingPercent={2.5}
      />,
    );
    expect(screen.getByText('$550.00')).toBeInTheDocument();
    expect(screen.getByText('$563.75')).toBeInTheDocument();
    expect(screen.getByText(/includes \$13\.75 handling, 2\.5%/)).toBeInTheDocument();
  });

  it('lets the registrant choose an option', async () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <PaymentOptions
        paymentOptions={DEPOSIT_OPTIONS}
        selected="Full Payment"
        onSelect={onSelect}
        online
        handlingPercent={2.5}
      />,
    );
    await userEvent.click(screen.getByRole('radio', { name: '50% Deposit: $550.00' }));
    expect(onSelect).toHaveBeenCalledWith('50% Deposit');
  });

  it('has nothing to choose with one option, and no online total without PayPal', () => {
    renderWithProviders(
      <PaymentOptions
        paymentOptions={SINGLE_OPTION}
        selected="Full payment"
        onSelect={() => undefined}
        online={false}
        handlingPercent={2.5}
      />,
    );
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText('By check')).toBeInTheDocument();
    expect(screen.queryByText('Online')).toBeNull();
  });
});
