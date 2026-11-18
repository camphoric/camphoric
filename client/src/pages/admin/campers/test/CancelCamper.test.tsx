import userEvent from '@testing-library/user-event';
import type { ApiCustomCharge } from 'api-types';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { CancelCamperView, feesSummary } from '../CancelCamper';
import { CAMPER } from './previews';

function view() {
  const onConfirm = vi.fn();
  renderWithProviders(
    <CancelCamperView name="Sam Alpha" preview={CAMPER} onConfirm={onConfirm} onCancel={vi.fn()} />,
  );
  return { onConfirm, user: userEvent.setup() };
}

const deleteButton = () => screen.getByRole('button', { name: 'Delete' });

describe('CancelCamperView', () => {
  it('deletes with no fee unless one is asked for', async () => {
    const { onConfirm, user } = view();
    expect(screen.getByText('1 custom charge: Linens $25.00')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Fee' })).not.toBeInTheDocument();
    await user.click(deleteButton());
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it('offers to keep a fee, with a note naming the camper', async () => {
    const { onConfirm, user } = view();
    await user.click(screen.getByRole('checkbox', { name: /Keep a cancellation fee/ }));
    expect(deleteButton()).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('Cancellation: Sam Alpha');

    await user.type(screen.getByRole('textbox', { name: 'Fee' }), '50');
    expect(deleteButton()).toBeEnabled();
    await user.click(deleteButton());
    expect(onConfirm).toHaveBeenCalledWith({ amount: 50, notes: 'Cancellation: Sam Alpha' });
  });

  it('holds the delete back for a fee of nothing', async () => {
    const { user } = view();
    await user.click(screen.getByRole('checkbox', { name: /Keep a cancellation fee/ }));
    await user.type(screen.getByRole('textbox', { name: 'Fee' }), '0');
    expect(deleteButton()).toBeDisabled();
    expect(screen.getByText('Enter an amount above $0.')).toBeInTheDocument();
  });

  it('doesn’t offer a fee when the camper can’t be deleted', () => {
    renderWithProviders(
      <CancelCamperView
        name="Sam Alpha"
        preview={{
          ...CAMPER,
          can_delete: false,
          blocked_by: [{ detail: 'No.', count: 0, items: [] }],
        }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('checkbox', { name: /Keep a cancellation fee/ }),
    ).not.toBeInTheDocument();
  });
});

describe('CancelCamperView with the event’s fee', () => {
  const render = (offer: { amount: number | null; error?: string }) => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <CancelCamperView
        name="Sam Alpha"
        offer={offer}
        preview={CAMPER}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    return { onConfirm, user: userEvent.setup() };
  };

  it('starts ticked, with what the event’s fee comes to', async () => {
    const { onConfirm, user } = render({ amount: 40 });
    expect(screen.getByRole('checkbox', { name: /Keep a cancellation fee/ })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Fee' })).toHaveValue('$40');
    expect(
      screen.getByText('The event’s cancellation fee for Sam Alpha today is $40.00.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledWith({ amount: 40, notes: 'Cancellation: Sam Alpha' });
  });

  it('starts unticked when it comes to nothing', () => {
    render({ amount: 0 });
    expect(screen.getByRole('checkbox', { name: /Keep a cancellation fee/ })).not.toBeChecked();
  });

  it('says when it couldn’t be worked out, and starts unticked', () => {
    render({ amount: null, error: 'The event’s cancellation fee couldn’t be worked out: x' });
    expect(screen.getByText(/couldn’t be worked out: x/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Keep a cancellation fee/ })).not.toBeChecked();
  });
});

describe('feesSummary', () => {
  it('lists each fee with its note', () => {
    const fees = [
      { amount: '50.00', notes: 'Cancellation: Sam Alpha' },
      { amount: '10.00', notes: '' },
    ] as ApiCustomCharge[];
    expect(feesSummary(fees)).toBe('$50.00 (Cancellation: Sam Alpha), $10.00');
  });
});
