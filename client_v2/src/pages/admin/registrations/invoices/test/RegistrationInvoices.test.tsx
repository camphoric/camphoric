import userEvent from '@testing-library/user-event';
import type { ApiEvent, AugmentedRegistration, Role } from 'api-types';
import { PermissionsProvider } from 'hooks/permissions';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RegistrationInvoices } from '../RegistrationInvoices';
import { LEDGER, TWO_CHECKS, TWO_CHECKS_PAYMENTS } from './fixtures';

const { delPayment, restore, deletedEnabled, mutation } = vi.hoisted(() => ({
  delPayment: vi.fn(),
  restore: vi.fn(),
  deletedEnabled: vi.fn(),
  mutation: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null }),
}));

vi.mock('store/entities', () => ({
  invoiceHooks: {
    useList: () => ({ data: [TWO_CHECKS] }),
    useDelete: () => ({ mutate: vi.fn() }),
    useUpdate: mutation,
  },
  paymentHooks: {
    useList: () => ({ data: TWO_CHECKS_PAYMENTS }),
    useDelete: () => ({ mutate: delPayment }),
  },
  pricingOverrideHooks: {
    useList: () => ({ data: [] }),
    useCreate: mutation,
    useUpdate: mutation,
    useDelete: () => ({ mutate: vi.fn() }),
  },
}));
vi.mock('store/invoices', () => ({
  useInvoiceStatusAction: mutation,
  useCheckPayPalOrder: mutation,
  useRecordPayment: mutation,
  useRefundPayPal: mutation,
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
              deleted_by: { id: 1, username: 'boss', name: 'Boss' },
            },
          ]
        : undefined,
    };
  },
  useRestore: () => ({ mutate: restore, isPending: false }),
}));

const event = { payment_schema: {}, epayment_handling: 2.5 } as unknown as ApiEvent;
const registration = {
  id: 5,
  server_pricing_results: { total: 1000, campers: [] },
  ...LEDGER,
} as unknown as AugmentedRegistration;

function setup(role: Role) {
  renderWithProviders(
    <PermissionsProvider userRole={role}>
      <RegistrationInvoices event={event} registration={registration} />
    </PermissionsProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  delPayment.mockClear();
  restore.mockClear();
});

describe('RegistrationInvoices', () => {
  it('shows the ledger and each invoice', () => {
    setup('reporter');
    expect(screen.getByText('Total owed')).toBeInTheDocument();
    expect(screen.getByText('Invoice #1: 50% Deposit')).toBeInTheDocument();
  });

  it('lets an Admin delete a payment after confirming', async () => {
    const user = setup('admin');
    await user.click(screen.getByRole('button', { name: 'Delete the Check payment of $450.00' }));
    expect(await screen.findByText('Delete the Check payment of $450.00?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(delPayment).toHaveBeenCalledWith({ id: 11 });
  });

  it('doesn’t let a Registrar delete a payment, but restore one', async () => {
    const user = setup('registrar');
    expect(screen.queryByRole('button', { name: /^Delete the/ })).toBeNull();
    expect(screen.getByText(/Card payment of \$50\.00 — deleted .* by Boss/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    expect(restore).toHaveBeenCalledWith(4, expect.anything());
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeInTheDocument();
  });

  it('offers a Reporter none of it', () => {
    setup('reporter');
    expect(screen.queryByRole('button', { name: 'Record payment' })).toBeNull();
    expect(screen.queryByText('Deleted payments')).toBeNull();
    expect(deletedEnabled).toHaveBeenLastCalledWith(false);
  });
});
