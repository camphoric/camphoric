import userEvent from '@testing-library/user-event';
import type { ApiEvent } from 'api-types';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EditInvoiceModal } from '../EditInvoiceModal';
import { NewInvoiceModal } from '../NewInvoiceModal';
import { RecordPaymentModal } from '../RecordPaymentModal';
import { RefundModal } from '../RefundModal';
import {
  CONFIRMING_PAYPAL,
  OPEN,
  OVERPAID,
  OVERPAID_PAYMENTS,
  payment,
  PAYPAL_REFUNDED,
  PAYPAL_REFUNDED_PAYMENTS,
  PROCESSING_PAYPAL,
  TWO_CHECKS,
  TWO_CHECKS_PAYMENTS,
} from './fixtures';

const { update, record, refundPayPal, createInvoice, mutation } = vi.hoisted(() => ({
  update: vi.fn((body: object) => Promise.resolve(body)),
  createInvoice: vi.fn(),
  record: vi.fn(),
  refundPayPal: vi.fn(),
  mutation: (mutate: unknown) => ({
    mutate,
    mutateAsync: mutate,
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
    // What changed, from the version the dialog opened at.
    expect(update).toHaveBeenCalledWith({
      id: 1,
      version: 1,
      amount: '1000.00',
      handling: '25.00',
    });
  });

  it('doesn’t change what it asks while PayPal is processing a payment on it', () => {
    // PayPal's payment is recorded as what it asked then (DR-133).
    renderWithProviders(
      <EditInvoiceModal
        invoice={PROCESSING_PAYPAL}
        uninvoicedBalance={450}
        handlingPercent={2.5}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Amount' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Electronic payment handling' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Use the balance' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Calculate' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /Memo/ })).toBeEnabled();
  });

  it('nor while a PayPal capture on it is being confirmed', () => {
    renderWithProviders(
      <EditInvoiceModal
        invoice={CONFIRMING_PAYPAL}
        uninvoicedBalance={450}
        handlingPercent={2.5}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Amount' })).toBeDisabled();
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

  it('doesn’t offer an invoice PayPal is processing a payment on', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <RecordPaymentModal
        event={event}
        registrationId={5}
        invoices={[PROCESSING_PAYPAL, CONFIRMING_PAYPAL]}
        opened
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Apply to' })).toHaveValue(
      'On its own (a new “Payment received” invoice)',
    );
    await user.type(screen.getByRole('textbox', { name: 'Amount' }), '25');
    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ new_invoice: true, amount: 25 }),
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

  it('keeps one request id for a payment, whatever the amount', async () => {
    // A retry after a lost reply must not refund again, even for a changed
    // amount: PayPal answers a request id it has seen with that first refund,
    // and the server records what PayPal refunded (#767).
    const user = userEvent.setup();
    renderWithProviders(
      <RefundModal
        target={{ invoice: PAYPAL_REFUNDED, payment: PAYPAL_REFUNDED_PAYMENTS[0], amount: 925 }}
        payments={PAYPAL_REFUNDED_PAYMENTS}
        onClose={vi.fn()}
      />,
    );
    const refund = () => user.click(screen.getByRole('button', { name: 'Refund through PayPal' }));
    const amount = screen.getByRole('textbox', { name: 'Amount to refund' });
    const changeAmount = async (value: string) => {
      await user.clear(amount);
      await user.type(amount, value);
    };
    await refund();
    await refund(); // a retry after a timeout
    await changeAmount('500');
    await refund();
    const ids = (refundPayPal.mock.calls as [{ requestId: string }][]).map(
      ([body]) => body.requestId,
    );
    expect(ids).toEqual([ids[0], ids[0], ids[0]]);
    expect(refundPayPal).toHaveBeenLastCalledWith(
      expect.objectContaining({ amount: 500 }),
      expect.anything(),
    );
  });

  it('keeps a request id for each payment refunded from', async () => {
    // The same id sent for another payment would be answered with the first
    // payment's refund; a new one each time would refund twice (#767).
    const user = userEvent.setup();
    const card = payment({
      id: 23,
      invoice: 2,
      payment_type: 'Card',
      amount: '200.00',
      paypal_refundable: true,
      paypal_transaction_id: '8MC585209K746392H',
    });
    renderWithProviders(
      <RefundModal
        target={{ invoice: PAYPAL_REFUNDED, amount: 50 }}
        payments={[...PAYPAL_REFUNDED_PAYMENTS, card]}
        onClose={vi.fn()}
      />,
    );
    const refund = () => user.click(screen.getByRole('button', { name: 'Refund through PayPal' }));
    const choosePayment = async (label: RegExp) => {
      await user.click(screen.getByRole('combobox', { name: 'From payment' }));
      // The dropdown is still mid-transition in jsdom, so its options count as hidden.
      await user.click(screen.getByRole('option', { name: label, hidden: true }));
    };
    await refund();
    await refund(); // a retry after a timeout
    await choosePayment(/^Card/);
    await refund();
    await choosePayment(/^PayPal/);
    await refund(); // the first payment's retry, still
    const calls = (refundPayPal.mock.calls as [{ payment: number; requestId: string }][]).map(
      ([body]) => body,
    );
    expect(calls.map((body) => body.payment)).toEqual([21, 21, 23, 21]);
    const [first, retry, other, back] = calls.map((body) => body.requestId);
    expect([retry, back]).toEqual([first, first]);
    expect(other).not.toEqual(first);
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
