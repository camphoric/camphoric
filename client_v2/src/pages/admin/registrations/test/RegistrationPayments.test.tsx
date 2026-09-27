import userEvent from '@testing-library/user-event';
import type { ApiEvent, AugmentedRegistration, Role } from 'api-types';
import { PermissionsProvider } from 'hooks/permissions';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RegistrationPayments } from '../RegistrationPayments';

const { del, restore, deletedEnabled } = vi.hoisted(() => ({
  del: vi.fn(),
  restore: vi.fn(),
  deletedEnabled: vi.fn(),
}));

vi.mock('store/entities', () => ({
  paymentHooks: {
    useList: () => ({
      data: [{ id: 3, payment_type: 'Check', amount: '100.00', paid_on: '2026-10-01', notes: '' }],
    }),
    useDelete: () => ({ mutate: del }),
  },
  pricingOverrideHooks: {
    useList: () => ({ data: [] }),
    useCreate: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdate: () => ({ mutate: vi.fn(), isPending: false }),
    useDelete: () => ({ mutate: vi.fn() }),
  },
}));
vi.mock('store/deletes', async () => ({
  ...(await import('test/deletes')).mockDeletes,
  useDeletedPayments: (_params: unknown, enabled: boolean) => {
    deletedEnabled(enabled);
    return {
      data: enabled
        ? [
            {
              id: 4,
              payment_type: 'Card',
              amount: '50.00',
              paid_on: null,
              deleted_at: '2026-09-26T18:00:00Z',
              deleted_by: { id: 1, username: 'reggie', name: 'Reggie' },
            },
          ]
        : undefined,
    };
  },
  useRestore: () => ({ mutate: restore, isPending: false }),
}));
vi.mock('../AddPaymentModal', () => ({ AddPaymentModal: () => null }));

const event = { payment_schema: {} } as unknown as ApiEvent;
const registration = {
  id: 5,
  payment_type: 'Check',
  server_pricing_results: { total: 0, campers: [] },
  total_owed: 150,
  total_payments: 100,
  total_balance: 50,
} as unknown as AugmentedRegistration;

function setup(role: Role) {
  renderWithProviders(
    <PermissionsProvider userRole={role}>
      <RegistrationPayments event={event} registration={registration} />
    </PermissionsProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  del.mockClear();
  restore.mockClear();
});

describe('RegistrationPayments', () => {
  it('deletes a payment after confirming', async () => {
    const user = setup('registrar');
    await user.click(screen.getByRole('button', { name: 'Delete the Check payment of $100.00' }));
    expect(await screen.findByText('Delete the Check payment of $100.00?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(del).toHaveBeenCalledWith({ id: 3 });
  });

  it('restores a deleted payment', async () => {
    const user = setup('admin');
    expect(screen.getByText(/Card payment of \$50\.00 — deleted .* by Reggie/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    expect(restore).toHaveBeenCalledWith(4, expect.anything());
  });

  it('offers a Reporter neither', () => {
    setup('reporter');
    expect(screen.queryByRole('button', { name: /Delete the/ })).toBeNull();
    expect(screen.queryByText('Deleted payments')).toBeNull();
    expect(deletedEnabled).toHaveBeenLastCalledWith(false);
  });
});
