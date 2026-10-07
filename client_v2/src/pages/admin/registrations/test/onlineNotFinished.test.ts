import type { ApiInvoice } from 'api-types';
import { describe, expect, it } from 'vitest';

import { onlineNotFinished } from '../RegistrationsList';

function invoice(fields: Partial<ApiInvoice> = {}): ApiInvoice {
  return {
    id: 1,
    registration: 7,
    origin: 'registration',
    description: 'Full Payment',
    amount: '400.00',
    handling: '0.00',
    payment_type: 'PayPal',
    due_on: null,
    memo: '',
    notes: '',
    pending_paypal_order_id: 'ORDER',
    organizer_changed_at: null,
    cancelled_at: null,
    cancel_reason: '',
    created_by: null,
    created_by_name: null,
    total: '400.00',
    amount_paid: '0.00',
    amount_due: '400.00',
    overpaid: '0.00',
    status: 'open',
    payments: [],
    pay_url: '',
    created_at: '2026-10-01T12:00:00Z',
    updated_at: '2026-10-01T12:00:00Z',
    ...fields,
  };
}

describe('onlineNotFinished', () => {
  it('flags an open registration invoice with a PayPal order waiting', () => {
    expect(onlineNotFinished([invoice()])).toEqual(new Set([7]));
  });

  it('still flags one finished to pay later, whose payment type is cleared (#759)', () => {
    expect(onlineNotFinished([invoice({ payment_type: null })])).toEqual(new Set([7]));
  });

  it('leaves out a check invoice, a paid one, and one whose order was cleared', () => {
    expect(
      onlineNotFinished([
        invoice({ payment_type: 'Check', pending_paypal_order_id: null }),
        invoice({ status: 'paid' }),
        invoice({ pending_paypal_order_id: null }),
        invoice({ origin: 'admin' }),
      ]),
    ).toEqual(new Set());
  });
});
