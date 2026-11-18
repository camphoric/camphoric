import userEvent from '@testing-library/user-event';
import type { Role } from 'api-types';
import { PermissionsProvider } from 'hooks/permissions';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventAdminPayments } from '../EventAdminPayments';
import {
  LEDGER_INVOICES,
  LEDGER_PAYMENTS,
  NOT_INVOICED,
  REFUND_THROUGH_PAYPAL,
  TOTALS,
} from './fixtures';

const { search, navigate } = vi.hoisted(() => ({
  search: { current: {} },
  navigate: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ organizationId: '1', eventId: '7' }),
  useSearch: () => search.current,
  useNavigate: () => navigate,
}));
vi.mock('hooks/useAdminData', () => ({ useAugmentedRegistrations: () => [] }));
vi.mock('pages/admin/registrations', () => ({ RegistrationEditorModal: () => null }));
vi.mock('store/paymentsAttention', () => ({
  usePaymentsAttention: () => ({ data: [REFUND_THROUGH_PAYPAL, NOT_INVOICED] }),
}));
vi.mock('store/paymentsTotals', () => ({
  usePaymentsTotals: () => ({ data: TOTALS }),
}));
vi.mock('store/entities', () => ({
  eventHooks: { useById: () => ({ data: { id: 7, payment_types: [] } }) },
  invoiceHooks: { useList: () => ({ data: LEDGER_INVOICES }) },
  paymentHooks: { useList: () => ({ data: LEDGER_PAYMENTS }) },
}));

function setup(role: Role, paymentsTab?: string) {
  search.current = { paymentsTab };
  renderWithProviders(
    <PermissionsProvider userRole={role}>
      <EventAdminPayments />
    </PermissionsProvider>,
  );
}

/** The search the last navigation asked for, from the search before it. */
function navigatedTo(before: Record<string, string | undefined> = {}) {
  const { search: next } = navigate.mock.lastCall![0] as {
    search: (prev: Record<string, string | undefined>) => Record<string, string | undefined>;
  };
  return next(before);
}

beforeEach(() => navigate.mockReset());

describe('EventAdminPayments', () => {
  it('opens a registration’s invoices with the action ready', async () => {
    setup('registrar');
    expect(screen.getByRole('tab', { name: 'Needs attention (2)', selected: true })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Refund through PayPal' }));
    expect(navigatedTo()).toEqual({
      registrationId: '6',
      regTab: 'fees',
      invoiceAction: 'refund',
      invoiceId: '2',
      paymentId: '21',
    });
  });

  it('opens it with no action for a Reporter', async () => {
    setup('reporter');
    await userEvent.click(screen.getAllByRole('button', { name: 'View registration' })[0]);
    expect(navigatedTo()).toEqual({ registrationId: '6', regTab: 'fees' });
  });

  it('lists every invoice, with the totals of the rows shown', () => {
    setup('reporter', 'invoices');
    expect(screen.getByRole('cell', { name: '#3' })).toBeInTheDocument();
    expect(screen.getByLabelText('Totals of the rows shown')).toHaveTextContent('$1,335.00');
  });

  it('lists every payment and refund, and filters to refunds', async () => {
    setup('reporter', 'payments');
    expect(screen.getByLabelText('Totals of the rows shown')).toHaveTextContent('Net$630.00');
    await userEvent.click(screen.getByText('Refunds'));
    expect(navigatedTo({ paypage: '2' })).toEqual({
      paykind: 'refund',
      paytype: undefined,
      payfrom: undefined,
      payto: undefined,
      paypage: undefined,
    });
  });

  it('shows the event’s totals after the payments', () => {
    setup('reporter', 'totals');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Needs attention (2)',
      'Invoices',
      'Payments and refunds',
      'Totals',
    ]);
    expect(screen.getByRole('region', { name: 'Owed and received' })).toHaveTextContent(
      '$9,374.00',
    );
  });
});
