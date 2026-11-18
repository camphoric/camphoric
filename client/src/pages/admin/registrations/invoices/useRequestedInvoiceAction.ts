/**
 * An invoice action asked for by the URL (SPEC §4, §8.4, §8.11): the Payments
 * area's "needs attention" items open a registration's invoices with the
 * action ready — `?invoiceAction` (`refund`, `new-invoice`, `send` or
 * `check-paypal`), on `?invoiceId`, refunding from `?paymentId`, or by hand
 * rather than through PayPal with `?refundBy=hand`. Once the
 * registration's invoices and payments have loaded it's handed over once, and
 * the request leaves the URL (replacing the entry, so going back doesn't ask
 * again). It's dropped, unhandled, for someone who can't change payments.
 */

import { useNavigate, useSearch } from '@tanstack/react-router';
import type { ApiInvoice, ApiPayment } from 'api-types';
import { usePermissions } from 'hooks/permissions';
import { useEffect, useRef } from 'react';

export const INVOICE_ACTIONS = ['refund', 'new-invoice', 'send', 'check-paypal'] as const;
export type InvoiceAction = (typeof INVOICE_ACTIONS)[number];

/** The search params that ask for an invoice action. */
export interface InvoiceActionSearch {
  invoiceAction?: InvoiceAction;
  invoiceId?: string;
  paymentId?: string;
  /** For `refund`: `hand` when it can't go back through PayPal. */
  refundBy?: 'hand';
}

export interface RequestedInvoiceAction {
  action: InvoiceAction;
  /** The invoice it's on: none for `new-invoice`, or one that's gone. */
  invoice?: ApiInvoice;
  /** For `refund`: the payment to refund from, when one was named. */
  payment?: ApiPayment;
  /** For `refund`: made another way and recorded, not through PayPal. */
  byHand: boolean;
}

const asString = (value: unknown) => (typeof value === 'string' ? value : undefined);

const isInvoiceAction = (value: unknown): value is InvoiceAction =>
  INVOICE_ACTIONS.includes(value as InvoiceAction);

export function useRequestedInvoiceAction(
  invoices: ApiInvoice[] | undefined,
  payments: ApiPayment[] | undefined,
  onRequest: (request: RequestedInvoiceAction) => void,
) {
  const search: Record<string, unknown> = useSearch({ strict: false });
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  // The request already handed over: the URL keeps it until the navigation
  // below lands, and a re-run meanwhile mustn't open it twice.
  const handled = useRef<string | undefined>(undefined);

  const invoiceAction = asString(search.invoiceAction);
  const invoiceId = asString(search.invoiceId);
  const paymentId = asString(search.paymentId);
  const refundBy = asString(search.refundBy);
  const request = invoiceAction
    ? `${invoiceAction}:${invoiceId}:${paymentId}:${refundBy}`
    : undefined;

  useEffect(() => {
    if (!request) {
      handled.current = undefined; // the next request is a new one, even if the same
      return;
    }
    if (handled.current === request || !invoices || !payments) return;
    handled.current = request;
    void navigate({
      to: '.',
      search: (prev: Record<string, string | undefined>) => ({
        ...prev,
        invoiceAction: undefined,
        invoiceId: undefined,
        paymentId: undefined,
        refundBy: undefined,
      }),
      replace: true,
    });
    if (!canEdit || !isInvoiceAction(invoiceAction)) return;
    onRequest({
      action: invoiceAction,
      invoice: invoices.find((i) => String(i.id) === invoiceId),
      payment: payments.find((p) => String(p.id) === paymentId),
      byHand: refundBy === 'hand',
    });
    // Handed over once per request; `onRequest` is a fresh closure each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, invoices, payments, canEdit]);
}
