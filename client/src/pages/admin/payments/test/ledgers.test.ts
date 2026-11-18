import type { AugmentedRegistration } from 'api-types';
import { describe, expect, it } from 'vitest';

import {
  filterInvoices,
  filterPayments,
  invoiceFiltersFromSearch,
  invoiceFiltersToSearch,
  invoiceTotals,
  paymentFiltersFromSearch,
  paymentFiltersToSearch,
  paymentTotals,
  registrationNames,
  withRefundsUnderPayments,
} from '../ledgers';
import { LEDGER_INVOICES, LEDGER_PAYMENTS } from './fixtures';

const ids = (rows: { id: number }[]) => rows.map((row) => row.id);

describe('registrationNames', () => {
  it('names a registration by its campers, else its email', () => {
    const names = registrationNames([
      {
        id: 5,
        registrant_email: 'pat@example.com',
        campers: [{ id: 1, attributes: { first_name: 'Pat', last_name: 'Alpha' } }],
      },
      { id: 7, registrant_email: 'kim@example.com', campers: [] },
    ] as unknown as AugmentedRegistration[]);
    expect(names.get(5)).toBe('Pat Alpha');
    expect(names.get(7)).toBe('kim@example.com');
  });
});

describe('the invoices ledger', () => {
  it('filters by status, origin, how it’s to be paid and due date', () => {
    expect(ids(filterInvoices(LEDGER_INVOICES, { status: 'overpaid' }))).toEqual([3]);
    expect(ids(filterInvoices(LEDGER_INVOICES, { origin: 'admin' }))).toEqual([3, 4]);
    expect(ids(filterInvoices(LEDGER_INVOICES, { type: 'PayPal' }))).toEqual([2]);
    // Only invoices with a due date fall in a range.
    expect(ids(filterInvoices(LEDGER_INVOICES, { dueFrom: '2026-11-01' }))).toEqual([1]);
    expect(ids(filterInvoices(LEDGER_INVOICES, { dueTo: '2026-10-15' }))).toEqual([3]);
    expect(ids(filterInvoices(LEDGER_INVOICES, {}))).toEqual([1, 2, 3, 4]);
  });

  it('totals the rows shown, a cancelled invoice asking for nothing', () => {
    expect(invoiceTotals(LEDGER_INVOICES)).toEqual({
      asked: 1335,
      paid: 630,
      due: 725,
      overpaid: 20,
    });
  });

  it('keeps its filters in the URL, starting the table over', () => {
    const filters = { status: 'open', dueFrom: '2026-11-01' };
    const search = invoiceFiltersToSearch(filters);
    expect(search).toEqual({
      invstatus: 'open',
      invorigin: undefined,
      invtype: undefined,
      invfrom: '2026-11-01',
      invto: undefined,
      invpage: undefined,
    });
    expect(invoiceFiltersFromSearch(search as Record<string, string>)).toMatchObject(filters);
  });
});

describe('the payments ledger', () => {
  it('lists each refund under the payment it gives money back from', () => {
    expect(ids(withRefundsUnderPayments(LEDGER_PAYMENTS))).toEqual([11, 31, 21, 22]);
  });

  it('lists a refund by its own date when its payment isn’t shown', () => {
    const refunds = filterPayments(LEDGER_PAYMENTS, { kind: 'refund' });
    expect(ids(withRefundsUnderPayments(refunds))).toEqual([22]);
  });

  it('filters by payments or refunds, type and date', () => {
    expect(ids(filterPayments(LEDGER_PAYMENTS, { kind: 'payment' }))).toEqual([11, 21, 31]);
    expect(ids(filterPayments(LEDGER_PAYMENTS, { type: 'PayPal' }))).toEqual([21, 22]);
    expect(ids(filterPayments(LEDGER_PAYMENTS, { from: '2026-10-02', to: '2026-10-03' }))).toEqual([
      21, 31,
    ]);
  });

  it('totals what the rows shown received, refunded and net', () => {
    expect(paymentTotals(LEDGER_PAYMENTS)).toEqual({ received: 705, refunded: 75, net: 630 });
    expect(paymentTotals(filterPayments(LEDGER_PAYMENTS, { type: 'PayPal' }))).toEqual({
      received: 485,
      refunded: 75,
      net: 410,
    });
  });

  it('keeps its filters in the URL', () => {
    const search = paymentFiltersToSearch({ kind: 'refund', to: '2026-10-31' });
    expect(paymentFiltersFromSearch(search as Record<string, string>)).toEqual({
      kind: 'refund',
      type: undefined,
      from: undefined,
      to: '2026-10-31',
    });
  });
});
