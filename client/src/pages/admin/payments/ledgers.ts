/**
 * The Payments area's ledgers (SPEC §8.11): every invoice and every payment
 * and refund of the event, filtered by what the URL holds, and the totals of
 * the rows shown. Amounts are the API's (the same invoice and payment fields
 * the registration screen shows, §9.7), never worked out again here.
 */

import type { ApiInvoice, ApiPayment, AugmentedRegistration } from 'api-types';
import { camperName } from 'utils/camper';
import { isoToDay } from 'utils/dates';
import { roundMoney } from 'utils/money';

type Search = Record<string, string | undefined>;

/** How each registration reads in a ledger: its campers' names, else its email. */
export function registrationNames(registrations: AugmentedRegistration[]): Map<number, string> {
  return new Map(
    registrations.map((r) => [
      r.id,
      r.campers.map(camperName).join(', ') || r.registrant_email || `Registration ${r.id}`,
    ]),
  );
}

// --- Invoices --------------------------------------------------------------------

/** The invoice ledger's filters, held in the URL (`?invstatus`, `?invorigin`, …). */
export interface InvoiceFilters {
  status?: string;
  origin?: string;
  /** How it's to be paid. */
  type?: string;
  /** Due on or after / on or before (`YYYY-MM-DD`). */
  dueFrom?: string;
  dueTo?: string;
}

export const invoiceFiltersFromSearch = (search: Search): InvoiceFilters => ({
  status: search.invstatus,
  origin: search.invorigin,
  type: search.invtype,
  dueFrom: search.invfrom,
  dueTo: search.invto,
});

export const invoiceFiltersToSearch = (filters: InvoiceFilters): Search => ({
  invstatus: filters.status || undefined,
  invorigin: filters.origin || undefined,
  invtype: filters.type || undefined,
  invfrom: filters.dueFrom || undefined,
  invto: filters.dueTo || undefined,
  // A new filter starts the table on its first page.
  invpage: undefined,
});

const within = (day: string | null | undefined, from?: string, to?: string) =>
  (!from || (!!day && day >= from)) && (!to || (!!day && day <= to));

export function filterInvoices(invoices: ApiInvoice[], filters: InvoiceFilters): ApiInvoice[] {
  return invoices.filter(
    (invoice) =>
      (!filters.status || invoice.status === filters.status) &&
      (!filters.origin || invoice.origin === filters.origin) &&
      (!filters.type || invoice.payment_type === filters.type) &&
      within(invoice.due_on, filters.dueFrom, filters.dueTo),
  );
}

export interface InvoiceTotals {
  /** What the invoices that aren't cancelled ask, handling included. */
  asked: number;
  paid: number;
  due: number;
  overpaid: number;
}

export function invoiceTotals(invoices: ApiInvoice[]): InvoiceTotals {
  const sum = (pick: (invoice: ApiInvoice) => number) =>
    roundMoney(invoices.reduce((total, invoice) => total + pick(invoice), 0));
  const live = (invoice: ApiInvoice) => invoice.status !== 'cancelled';
  return {
    asked: sum((i) => (live(i) ? Number(i.total) : 0)),
    paid: sum((i) => Number(i.amount_paid)),
    due: sum((i) => (live(i) ? Number(i.amount_due) : 0)),
    overpaid: sum((i) => Number(i.overpaid)),
  };
}

// --- Payments and refunds ---------------------------------------------------------

export type PaymentKind = 'payment' | 'refund';

export const isRefund = (payment: ApiPayment) => Number(payment.amount) < 0;

/** When it was paid or refunded: its date, else the day it was recorded. */
export const paymentDay = (payment: ApiPayment) => payment.paid_on ?? isoToDay(payment.created_at);

/** The payments ledger's filters, held in the URL (`?paykind`, `?paytype`, …). */
export interface PaymentFilters {
  kind?: string;
  type?: string;
  /** Paid on or after / on or before (`YYYY-MM-DD`). */
  from?: string;
  to?: string;
}

export const paymentFiltersFromSearch = (search: Search): PaymentFilters => ({
  kind: search.paykind,
  type: search.paytype,
  from: search.payfrom,
  to: search.payto,
});

export const paymentFiltersToSearch = (filters: PaymentFilters): Search => ({
  paykind: filters.kind || undefined,
  paytype: filters.type || undefined,
  payfrom: filters.from || undefined,
  payto: filters.to || undefined,
  paypage: undefined,
});

export function filterPayments(payments: ApiPayment[], filters: PaymentFilters): ApiPayment[] {
  return payments.filter(
    (payment) =>
      (!filters.kind || (filters.kind === 'refund') === isRefund(payment)) &&
      (!filters.type || payment.payment_type === filters.type) &&
      within(paymentDay(payment), filters.from, filters.to),
  );
}

/**
 * Payments by date, oldest first, each followed by its refunds (by date); a
 * refund whose payment isn't among them (filtered out, or of nothing) takes
 * its own place by date.
 */
export function withRefundsUnderPayments(payments: ApiPayment[]): ApiPayment[] {
  const byDay = (a: ApiPayment, b: ApiPayment) =>
    paymentDay(a).localeCompare(paymentDay(b)) || a.id - b.id;
  const ids = new Set(payments.map((p) => p.id));
  const nested = (p: ApiPayment) =>
    isRefund(p) && p.refund_of != null && ids.has(Number(p.refund_of));
  const refundsOf = new Map<number, ApiPayment[]>();
  payments.filter(nested).forEach((refund) => {
    const of = Number(refund.refund_of);
    refundsOf.set(of, [...(refundsOf.get(of) ?? []), refund]);
  });
  return payments
    .filter((p) => !nested(p))
    .sort(byDay)
    .flatMap((p) => [p, ...(refundsOf.get(p.id) ?? []).sort(byDay)]);
}

export interface PaymentTotals {
  received: number;
  /** Given back, as a positive amount. */
  refunded: number;
  net: number;
}

export function paymentTotals(payments: ApiPayment[]): PaymentTotals {
  let received = 0;
  let refunded = 0;
  payments.forEach((payment) => {
    const amount = Number(payment.amount);
    if (amount < 0) refunded -= amount;
    else received += amount;
  });
  return {
    received: roundMoney(received),
    refunded: roundMoney(refunded),
    net: roundMoney(received - refunded),
  };
}
