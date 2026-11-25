import type { ApiPaymentTypeChoice } from 'api-types';
import { describe, expect, it } from 'vitest';

import { paymentTypeLabel, paymentTypeOptions } from '../paymentTypes';

const own = [
  { value: 'Venmo', label: 'Venmo (@camp)' },
  { value: 'Voucher', label: 'Discount or Gifted Credit' },
];
const choice = (value: string, label = value, online = false): ApiPaymentTypeChoice => ({
  value,
  label,
  online,
});
const event = {
  payment_types: own,
  payment_type_choices: [
    choice('Check'),
    choice('Cash'),
    choice('Venmo', 'Venmo (@camp)'),
    choice('Voucher', 'Discount or Gifted Credit'),
  ],
};

describe('paymentTypeLabel', () => {
  it('shows the event’s own type by its label', () => {
    expect(paymentTypeLabel('Venmo', own)).toBe('Venmo (@camp)');
  });

  it('shows a built-in type by its name', () => {
    expect(paymentTypeLabel('Cash', own)).toBe('Cash');
  });

  it('shows a type the event no longer defines as what was stored', () => {
    expect(paymentTypeLabel('Zelle', own)).toBe('Zelle');
    expect(paymentTypeLabel('Zelle')).toBe('Zelle');
  });

  it('reads a malformed list of the event’s types as none', () => {
    const malformed = { not: 'a list' } as unknown as typeof own;
    expect(paymentTypeLabel('Venmo', malformed)).toBe('Venmo');
    expect(paymentTypeLabel('Venmo', [null, ...own] as unknown as typeof own)).toBe(
      'Venmo (@camp)',
    );
  });
});

describe('paymentTypeOptions', () => {
  it('offers the event’s choices, in order', () => {
    expect(paymentTypeOptions(event)).toEqual([
      { value: 'Check', label: 'Check' },
      { value: 'Cash', label: 'Cash' },
      { value: 'Venmo', label: 'Venmo (@camp)' },
      { value: 'Voucher', label: 'Discount or Gifted Credit' },
    ]);
  });

  it('keeps a type a payment already has', () => {
    expect(paymentTypeOptions(event, 'PayPal').map((o) => o.value)).toEqual([
      'Check',
      'Cash',
      'Venmo',
      'Voucher',
      'PayPal',
    ]);
    expect(paymentTypeOptions(event, 'Voucher')).toHaveLength(4);
  });

  it('offers each type once', () => {
    const repeated = { ...event, payment_type_choices: [choice('Check'), choice('Check')] };
    expect(paymentTypeOptions(repeated).map((o) => o.value)).toEqual(['Check']);
  });

  it('offers every built-in type without the event’s list', () => {
    expect(paymentTypeOptions(undefined).map((o) => o.value)).toEqual([
      'Check',
      'PayPal',
      'Card',
      'Cash',
    ]);
  });
});
