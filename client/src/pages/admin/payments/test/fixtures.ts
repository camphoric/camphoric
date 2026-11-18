/**
 * The Payments area's stories and tests (SPEC §8.11): one "needs attention"
 * item of each kind (a refund that can go back through PayPal and one that
 * can't), and a small event's invoices and payments — checks, a PayPal payment
 * with a partial refund under it, and an overpaid invoice.
 */

import type { ApiPaymentsAttentionItem } from 'api-types';
import { invoice, payment } from 'pages/admin/registrations/invoices/test/fixtures';

export function attentionItem(
  over: Partial<ApiPaymentsAttentionItem> & Pick<ApiPaymentsAttentionItem, 'kind'>,
): ApiPaymentsAttentionItem {
  return {
    registration: 5,
    registrant_email: 'pat@example.com',
    campers: ['Pat Alpha', 'Sam Alpha'],
    invoice: 1,
    amount: '50.00',
    due_on: null,
    payment: null,
    paypal_refund: false,
    paypal_processing: false,
    ...over,
  };
}

export const REFUND_THROUGH_PAYPAL = attentionItem({
  kind: 'refund_due',
  registration: 6,
  registrant_email: 'lee@example.com',
  campers: ['Lee Beta'],
  invoice: 2,
  amount: '75.00',
  payment: 21,
  paypal_refund: true,
});
export const REFUND_BY_HAND = attentionItem({
  kind: 'refund_due',
  registration: 7,
  registrant_email: 'kim@example.com',
  campers: [],
  invoice: 3,
  amount: '20.00',
});
export const OVERPAID_ITEM = attentionItem({
  kind: 'overpaid_invoice',
  invoice: 4,
  amount: '30.00',
});
export const NOT_INVOICED = attentionItem({
  kind: 'not_invoiced',
  invoice: null,
  amount: '425.00',
});
export const PAST_DUE = attentionItem({
  kind: 'past_due',
  registration: 8,
  registrant_email: 'drew@example.com',
  campers: ['Drew Gamma'],
  invoice: 9,
  amount: '550.00',
  due_on: '2026-11-01',
});
export const ONLINE_UNFINISHED = attentionItem({
  kind: 'online_unfinished',
  registration: 8,
  registrant_email: 'drew@example.com',
  campers: ['Drew Gamma'],
  invoice: 10,
  amount: '1025.00',
});
export const PAYPAL_PROCESSING = attentionItem({
  kind: 'online_unfinished',
  invoice: 11,
  amount: '200.00',
  paypal_processing: true,
});

export const ATTENTION_ITEMS = [
  REFUND_THROUGH_PAYPAL,
  REFUND_BY_HAND,
  OVERPAID_ITEM,
  NOT_INVOICED,
  PAST_DUE,
  ONLINE_UNFINISHED,
  PAYPAL_PROCESSING,
];

/** How the ledgers' registrations read. */
export const NAMES = new Map([
  [5, 'Pat Alpha, Sam Alpha'],
  [6, 'Lee Beta'],
  [7, 'kim@example.com'],
]);

export const LEDGER_INVOICES = [
  invoice({
    id: 1,
    description: 'Full Payment',
    amount: '825.00',
    total: '825.00',
    amount_paid: '100.00',
    amount_due: '725.00',
    status: 'partially_paid',
    due_on: '2026-12-01',
  }),
  invoice({
    id: 2,
    registration: 6,
    description: 'Full Payment',
    payment_type: 'PayPal',
    amount: '400.00',
    handling: '10.00',
    total: '410.00',
    amount_paid: '410.00',
    amount_due: '0.00',
    status: 'paid',
  }),
  invoice({
    id: 3,
    registration: 7,
    origin: 'admin',
    created_by_name: 'Reggie',
    description: 'Registration balance',
    amount: '100.00',
    total: '100.00',
    amount_paid: '120.00',
    amount_due: '0.00',
    overpaid: '20.00',
    status: 'overpaid',
    due_on: '2026-10-15',
  }),
  invoice({
    id: 4,
    registration: 7,
    origin: 'admin',
    description: 'Linens',
    amount: '25.00',
    total: '25.00',
    amount_due: '25.00',
    status: 'cancelled',
    cancelled_at: '2026-10-20T18:00:00Z',
  }),
];

export const LEDGER_PAYMENTS = [
  payment({ id: 11, amount: '100.00', paid_on: '2026-10-01', notes: 'Check 1031' }),
  payment({
    id: 21,
    registration: 6,
    invoice: 2,
    payment_type: 'PayPal',
    amount: '485.00',
    paid_on: '2026-10-03',
    refunded: '75.00',
    paypal_refundable: true,
    paypal_transaction_id: '3C679366HH908993F',
  }),
  payment({
    id: 31,
    registration: 7,
    invoice: 3,
    amount: '120.00',
    paid_on: '2026-10-02',
  }),
  payment({
    id: 22,
    registration: 6,
    invoice: 2,
    payment_type: 'PayPal',
    amount: '-75.00',
    paid_on: '2026-10-20',
    refund_of: 21,
    paypal_transaction_id: '1JU08902781691411',
  }),
];
