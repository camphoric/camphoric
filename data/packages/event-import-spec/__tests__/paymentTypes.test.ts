/**
 * The event import schema's check of the event's own payment types (SPEC
 * DR-164): what the server would refuse fails before any request is made.
 */

import { describe, expect, test } from '@jest/globals';

import { validateEventImport } from '../index.ts';

const valid = (paymentTypes: unknown) => validateEventImport({
  organization: 'Test',
  event: { name: 'Test', payment_types: paymentTypes },
  reports: [],
  registration_types: [],
}).length === 0;

describe('event.payment_types', () => {
  test('accepts a list of value and label pairs', () => {
    expect(valid([{ value: 'Venmo', label: 'Venmo' }, { value: 'Cash', label: 'Cash at the gate' }]))
      .toBe(true);
    expect(valid([])).toBe(true);
  });

  test('is optional', () => {
    expect(validateEventImport({
      organization: 'Test', event: { name: 'Test' }, reports: [], registration_types: [],
    })).toEqual([]);
  });

  test('needs a value and a label, neither blank', () => {
    expect(valid([{ value: 'Venmo' }])).toBe(false);
    expect(valid([{ label: 'Venmo' }])).toBe(false);
    expect(valid([{ value: '', label: 'Venmo' }])).toBe(false);
    expect(valid([{ value: 'Venmo', label: '   ' }])).toBe(false);
  });

  test('takes nothing else', () => {
    expect(valid([{ value: 'Venmo', label: 'Venmo', online: true }])).toBe(false);
  });

  test('keeps the value within what the server stores', () => {
    expect(valid([{ value: 'V'.repeat(255), label: 'Long' }])).toBe(true);
    expect(valid([{ value: 'V'.repeat(256), label: 'Long' }])).toBe(false);
  });
});
