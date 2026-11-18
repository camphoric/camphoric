/**
 * How long PayPal can refund a payment (SPEC §9.7; §15, DR-172): it refunds a
 * capture for 180 days, and the server stops a day sooner. After that the
 * money goes back another way and the refund is recorded by hand.
 */

import type { ApiPayment } from 'api-types';
import { formatDay } from 'utils/dates';

/** What's left of a payment to refund. */
const left = (payment: ApiPayment) => Number(payment.amount) - Number(payment.refunded ?? 0);

/** Its window is over, with something left that PayPal can no longer give back. */
export const paypalRefundEnded = (payment: ApiPayment) =>
  !!payment.paypal_refund_until && !payment.paypal_refundable && left(payment) > 0;

/**
 * How a PayPal or card payment's refund window reads, while something of it is
 * left to refund: until when, or that it has ended. None for any other payment.
 */
export function paypalRefundNote(payment: ApiPayment): string | null {
  const until = payment.paypal_refund_until;
  if (!until || left(payment) <= 0) return null;
  return payment.paypal_refundable
    ? `PayPal can refund it until ${formatDay(until)}`
    : `PayPal’s refund window ended ${formatDay(until)}`;
}
