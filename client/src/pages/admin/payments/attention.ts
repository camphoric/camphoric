/**
 * The kinds of "needs attention" item (SPEC §8.11; §15, DR-171): how each
 * reads, what to do about it, and the invoice action that does it — opened on
 * the registration's invoices, ready to confirm (§8.4).
 */

import type { ApiPaymentsAttentionItem, PaymentsAttentionKind } from 'api-types';
import type { InvoiceActionSearch } from 'pages/admin/registrations/invoices';
import { formatDay } from 'utils/dates';

/** In the order the server lists them, most pressing first. */
export const ATTENTION_KINDS: readonly PaymentsAttentionKind[] = [
  'refund_due',
  'overpaid_invoice',
  'not_invoiced',
  'past_due',
  'online_unfinished',
];

export const ATTENTION_LABEL: Record<PaymentsAttentionKind, string> = {
  refund_due: 'Refund due',
  overpaid_invoice: 'Overpaid invoice',
  not_invoiced: 'Not invoiced',
  past_due: 'Past due',
  online_unfinished: 'Online payment not finished',
};

export const ATTENTION_COLOR: Record<PaymentsAttentionKind, string> = {
  refund_due: 'orange',
  overpaid_invoice: 'orange',
  not_invoiced: 'red',
  past_due: 'red',
  online_unfinished: 'blue',
};

const invoiceName = (item: ApiPaymentsAttentionItem) =>
  item.invoice != null ? `Invoice #${item.invoice}` : 'Its invoice';

/** What the item is about, and what to do. */
export function attentionDetail(item: ApiPaymentsAttentionItem): string {
  switch (item.kind) {
    case 'refund_due':
      return item.paypal_refund
        ? 'Paid more than it owes. The refund can go back through PayPal.'
        : 'Paid more than it owes. Give the money back another way, and record the refund.';
    case 'overpaid_invoice':
      return `${invoiceName(item)} is paid more than it asks. Refund the difference, or edit the invoice.`;
    case 'not_invoiced':
      return 'Owed, but no invoice asks for it yet. Make an invoice for the balance.';
    case 'past_due':
      return `${invoiceName(item)} was due ${item.due_on ? formatDay(item.due_on) : 'earlier'}. Send it again.`;
    case 'online_unfinished':
      return item.paypal_processing
        ? `PayPal is still processing a payment on ${invoiceName(item).toLowerCase()}, longer than it’s asked about. Check the PayPal order.`
        : `A PayPal payment on ${invoiceName(item).toLowerCase()} was started and never confirmed. Check the PayPal order.`;
  }
}

/** The button's label, and the invoice action it opens. */
export function attentionAction(item: ApiPaymentsAttentionItem): {
  label: string;
  search: InvoiceActionSearch;
} {
  const invoiceId = item.invoice != null ? String(item.invoice) : undefined;
  switch (item.kind) {
    case 'refund_due':
      return {
        label: item.paypal_refund ? 'Refund through PayPal' : 'Record a refund',
        search: {
          invoiceAction: 'refund',
          invoiceId,
          paymentId: item.payment != null ? String(item.payment) : undefined,
          // PayPal can't give it back (past its 180 days, say): record one made another way.
          refundBy: item.paypal_refund ? undefined : 'hand',
        },
      };
    case 'overpaid_invoice':
      return { label: 'Refund the difference', search: { invoiceAction: 'refund', invoiceId } };
    case 'not_invoiced':
      return { label: 'Make an invoice', search: { invoiceAction: 'new-invoice' } };
    case 'past_due':
      return { label: 'Send invoice', search: { invoiceAction: 'send', invoiceId } };
    case 'online_unfinished':
      return { label: 'Check PayPal order', search: { invoiceAction: 'check-paypal', invoiceId } };
  }
}

/** How many items of each kind. */
export function countByKind(
  items: readonly ApiPaymentsAttentionItem[],
): Record<PaymentsAttentionKind, number> {
  const counts = Object.fromEntries(ATTENTION_KINDS.map((kind) => [kind, 0])) as Record<
    PaymentsAttentionKind,
    number
  >;
  items.forEach((item) => (counts[item.kind] += 1));
  return counts;
}

/** Who the item is about: the campers' names, else the registrant's email. */
export const attentionWho = (item: ApiPaymentsAttentionItem) =>
  item.campers.filter(Boolean).join(', ') || item.registrant_email;
