import type { ApiInvoicePay } from 'api-types';

/** A check registrant's deposit invoice, half paid, payable online (#623). */
export const DUE: ApiInvoicePay = {
  event: { id: 2, name: 'Lark Camp 2027' },
  invoice: {
    id: 12,
    description: 'Registration balance',
    memo: 'The rest of your registration. Thanks!',
    due_on: '2027-06-20',
    amount: '1425.00',
    handling: '0.00',
    total: '1425.00',
    amount_paid: '0.00',
    amount_due: '1425.00',
    status: 'open',
    pending: false,
  },
  campers: ['Bob R.', 'Jane R.'],
  online: { clientId: 'sb', handling: 35.63, total: 1460.63, handlingPercent: 2.5 },
};

export const PAID: ApiInvoicePay = {
  ...DUE,
  invoice: {
    ...DUE.invoice,
    handling: '35.63',
    total: '1460.63',
    amount_paid: '1460.63',
    amount_due: '0.00',
    status: 'paid',
  },
  online: null,
};

export const CANCELLED: ApiInvoicePay = {
  ...DUE,
  invoice: { ...DUE.invoice, status: 'cancelled' },
  online: null,
};

export const NOT_ONLINE: ApiInvoicePay = { ...DUE, online: null };
