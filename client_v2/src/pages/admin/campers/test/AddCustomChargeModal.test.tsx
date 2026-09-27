import userEvent from '@testing-library/user-event';
import type { ApiCamper } from 'api-types';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { AddCustomChargeModal } from '../AddCustomChargeModal';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('store/entities', () => ({
  customChargeHooks: { useCreate: () => ({ mutate: create, isPending: false }) },
  customChargeTypeHooks: {
    useList: () => ({ data: [{ id: 3, label: 'Discount' }] }),
  },
}));

describe('AddCustomChargeModal', () => {
  it('takes a negative amount, for a discount or credit', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AddCustomChargeModal eventId={7} camper={{ id: 9 } as ApiCamper} opened onClose={vi.fn()} />,
    );
    const amount = screen.getByRole('textbox', { name: 'Amount' });
    await user.clear(amount);
    await user.type(amount, '-25');
    await user.click(screen.getByRole('button', { name: 'Add charge' }));
    expect(create).toHaveBeenCalledWith(
      { camper: 9, custom_charge_type: 3, amount: -25, notes: '' },
      expect.anything(),
    );
  });
});
