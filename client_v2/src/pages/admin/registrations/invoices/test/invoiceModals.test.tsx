import userEvent from '@testing-library/user-event';
import type { ApiEvent } from 'api-types';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EditInvoiceModal } from '../EditInvoiceModal';
import { NewInvoiceModal } from '../NewInvoiceModal';
import { RecordPaymentModal } from '../RecordPaymentModal';
import { RefundModal } from '../RefundModal';
import {
  OPEN,
  OVERPAID,
  OVERPAID_PAYMENTS,
  PAYPAL_REFUNDED,
  PAYPAL_REFUNDED_PAYMENTS,
  TWO_CHECKS,
  TWO_CHECKS_PAYMENTS,
} from './fixtures';

const { update, record, refundPayPal, createInvoice, mutation } = vi.hoisted(() => ({
  update: vi.fn(),
  createInvoice: vi.fn(),
  record: vi.fn(),
  refundPayPal: vi.fn(),
  mutation: (mutate: unknown) => ({
    mutate,
    reset: () => undefined,
    isPending: false,
    error: null,
  }),
}));

vi.mock('store/entities', () => ({ invoiceHooks: { useUpdate: () => mutation(update) } }));
vi.mock('store/invoices', () => ({
  useCreateInvoice: () => mutation(createInvoice),
  useRecordPayment: () => mutation(record),
  useRefundPayPal: () => mutation(refundPayPal),
}));

const event = { payment_schema: {} } as unknown as ApiEvent;

beforeEach(() => {
  update.mockClear();
  record.mockClear();
  refundPayPal.mockClear();
  createInvoice.mockClear();
});

describe('NewInvoiceModal', () => {
  it('starts with the balance no invoice asks for yet', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <NewInvoiceModal registrationId={5} uninvoicedBalance={425} opened onClose={vi.fn()} />,
    );
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue(
      'Registration balance',
    );
    await user.type(screen.getByRole('textbox', { name: /Memo/ }), 'The rest');
    await user.click(screen.getByRole('button', { name: 'Make invoice' }));
    expect(createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        registration: 5,
        description: 'Registration balance',
        amount: '425.00',
        memo: 'The rest',
      }),
      expect.anything(),
    );
  });
});

describe('EditInvoiceModal', () => {
  it('fills the amount from the balance and works out the handling fee', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <EditInvoiceModal
        invoice={OPEN}
        uninvoicedBalance={450}
        handlingPercent={2.5}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Use the balance' }));
    await user.click(screen.getByRole('button', { name: 'Calculate' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    // $550 + $450 = $1,000; 2.5% of it is $25.
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, amount: '1000.00', handling: '25.00' }),
      expect.anything(),
    );
  });
});

describe('RecordPaymentModal', () => {
  it('applies to the oldest open invoice, with what’s due on it', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <RecordPaymentModal
        event={event}
        registrationId={5}
        invoices={[TWO_CHECKS, OPEN, PAYPAL_REFUNDED]}
        opened
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveValue('$550');
    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ registration: 5, invoice: 1, amount: 550 }),
      expect.anything(),
    );
  });

  it('with nothing open, goes on an invoice of its own', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <RecordPaymentModal
        event={event}
        registrationId={5}
        invoices={[TWO_CHECKS]}
        opened
        onClose={vi.fn()}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: 'Amount' }), '25');
    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ new_invoice: true, amount: 25 }),
      expect.anything(),
    );
  });
});

describe('RefundModal', () => {
  it('refunds a PayPal payment through PayPal, up to what’s left', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <RefundModal
        target={{ invoice: PAYPAL_REFUNDED, payment: PAYPAL_REFUNDED_PAYMENTS[0], amount: 925 }}
        payments={PAYPAL_REFUNDED_PAYMENTS}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Up to $925.00')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Reason (sent to the payer)' }), 'Sorry');
    await user.click(screen.getByRole('button', { name: 'Refund through PayPal' }));
    expect(refundPayPal).toHaveBeenCalledWith(
      expect.objectContaining({ payment: 21, amount: 925, reason: 'Sorry' }),
      expect.anything(),
    );
    const [[body]] = refundPayPal.mock.calls as [[{ requestId: string }]];
    expect(body.requestId).toMatch(/.{8}/);
  });

  it('records a check mailed back as a negative payment', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <RefundModal
        target={{ invoice: TWO_CHECKS, payment: TWO_CHECKS_PAYMENTS[1], amount: 100 }}
        payments={TWO_CHECKS_PAYMENTS}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText('Refund through PayPal')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Record refund' }));
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ invoice: 1, refund_of: 12, amount: -100, payment_type: 'Check' }),
      expect.anything(),
    );
  });

  it('refunds the difference on an overpaid invoice', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <RefundModal
        target={{ invoice: OVERPAID, amount: 50 }}
        payments={OVERPAID_PAYMENTS}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Record refund' }));
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ invoice: 3, amount: -50 }),
      expect.anything(),
    );
  });
});
