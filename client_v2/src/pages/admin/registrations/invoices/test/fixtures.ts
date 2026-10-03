/**
 * Invoices and payments for the invoice stories and tests (SPEC §9.7): a check
 * deposit with two checks on it, a PayPal payment with its handling fee and a
 * partial refund, an overpaid invoice, a cancelled one, and one whose PayPal
 * payment wasn't confirmed.
 */

import type { ApiInvoice, ApiPayment } from 'api-types';

const stamps = { created_at: '2026-10-01T18:00:00Z', updated_at: '2026-10-01T18:00:00Z' };

export function invoice(over: Partial<ApiInvoice> & { id: number }): ApiInvoice {
  return {
    registration: 5,
    origin: 'registration',
    description: '50% Deposit',
    amount: '550.00',
    handling: '0.00',
    payment_type: 'Check',
    due_on: null,
    memo: '',
    notes: '',
    pending_paypal_order_id: null,
    cancelled_at: null,
    cancel_reason: '',
    created_by: null,
    created_by_name: null,
    total: '550.00',
    amount_paid: '0.00',
    amount_due: '550.00',
    overpaid: '0.00',
    status: 'open',
    payments: [],
    pay_url: `https://camp.example.org/invoices/token-${over.id}`,
    ...stamps,
    ...over,
  };
}

export function payment(over: Partial<ApiPayment> & { id: number }): ApiPayment {
  return {
    registration: 5,
    invoice: 1,
    payment_type: 'Check',
    paid_on: '2026-10-02',
    attributes: {},
    amount: '100.00',
    notes: '',
    refunded: '0.00',
    paypal_refundable: false,
    ...stamps,
    ...over,
  };
}

export const OPEN = invoice({ id: 1 });

export const TWO_CHECKS = invoice({
  id: 1,
  amount_paid: '550.00',
  amount_due: '0.00',
  status: 'paid',
  payments: [11, 12],
  notes: 'Second check came a week later',
});
export const TWO_CHECKS_PAYMENTS = [
  payment({ id: 11, amount: '450.00', notes: 'Check 1031' }),
  payment({ id: 12, amount: '100.00', paid_on: '2026-10-09', notes: 'Check 1040' }),
];

export const PAYPAL_REFUNDED = invoice({
  id: 2,
  description: 'Full Payment',
  amount: '1000.00',
  handling: '25.00',
  payment_type: 'PayPal',
  total: '1025.00',
  amount_paid: '925.00',
  amount_due: '100.00',
  status: 'partially_paid',
  memo: 'Thanks for registering!',
  payments: [21, 22],
});
export const PAYPAL_REFUNDED_PAYMENTS = [
  payment({
    id: 21,
    invoice: 2,
    payment_type: 'PayPal',
    amount: '1025.00',
    refunded: '100.00',
    paypal_refundable: true,
    paypal_transaction_id: '3C679366HH908993F',
    notes: 'Initial payment',
  }),
  payment({
    id: 22,
    invoice: 2,
    payment_type: 'PayPal',
    amount: '-100.00',
    refund_of: 21,
    paypal_transaction_id: '1JU08902781691411',
    notes: 'Meal plan dropped',
  }),
];

export const OVERPAID = invoice({
  id: 3,
  description: 'Registration balance',
  origin: 'admin',
  created_by_name: 'Reggie',
  amount: '400.00',
  total: '400.00',
  amount_paid: '450.00',
  amount_due: '0.00',
  overpaid: '50.00',
  status: 'overpaid',
  payments: [31],
});
export const OVERPAID_PAYMENTS = [payment({ id: 31, invoice: 3, amount: '450.00' })];

export const CANCELLED = invoice({
  id: 4,
  origin: 'payment_received',
  description: 'Payment received',
  amount: '0.00',
  total: '0.00',
  amount_due: '0.00',
  status: 'cancelled',
  cancelled_at: '2026-10-05T18:00:00Z',
  cancel_reason: 'Its payment was deleted.',
});

export const PENDING_PAYPAL = invoice({
  id: 5,
  description: 'Full Payment',
  amount: '400.00',
  total: '400.00',
  amount_due: '400.00',
  payment_type: 'Card',
  pending_paypal_order_id: '5O190127TN364715T',
});

export const LEDGER = {
  total_owed: 1025,
  total_paid: 925,
  balance: 100,
  handling_charges: 25,
  uninvoiced_balance: 0,
};
