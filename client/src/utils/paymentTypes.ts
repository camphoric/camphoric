/**
 * How payment types read and which an admin may choose (SPEC §9.7; §15,
 * DR-164). The built-in types show as their names (Check, PayPal, Card,
 * Voucher); the event's own show by their labels; a type the event no longer
 * defines shows as the value its payments stored.
 */

import type { ApiEvent, ApiEventPaymentType, PaymentType } from 'api-types';

export const BUILT_IN_PAYMENT_TYPES: PaymentType[] = ['Check', 'PayPal', 'Card', 'Voucher'];

/** How a stored payment type reads, given the event's own types. */
export const paymentTypeLabel = (value: string, own?: ApiEventPaymentType[]) =>
  (Array.isArray(own) ? own : []).find((t) => t?.value === value)?.label ?? value;

/**
 * The types a payment can be recorded as, for a choice: the event's
 * `payment_type_choices` (every built-in type when it has none), plus `keep`
 * when it isn't among them — what a payment already has, so its refund can be
 * recorded the same way after the event has dropped that type.
 */
export function paymentTypeOptions(
  event?: Partial<Pick<ApiEvent, 'payment_types' | 'payment_type_choices'>>,
  keep?: string | null,
): { value: string; label: string }[] {
  const values: string[] = event?.payment_type_choices?.map((c) => c.value) ?? [
    ...BUILT_IN_PAYMENT_TYPES,
  ];
  if (keep) values.push(keep);
  // Each once: a choice list can't repeat a value.
  return [...new Set(values)].map((value) => ({
    value,
    label: paymentTypeLabel(value, event?.payment_types),
  }));
}
