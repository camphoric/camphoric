/**
 * The event import schema's check of the event's cancellation fee (SPEC
 * DR-170): JsonLogic (an object or a number), or null; what the server would
 * refuse fails before any request is made.
 */

import { describe, expect, test } from '@jest/globals';

import { validateEventImport } from '../index.ts';

const valid = (fee: unknown) => validateEventImport({
  organization: 'Test',
  event: { name: 'Test', cancellation_fee: fee },
  reports: [],
  registration_types: [],
}).length === 0;

describe('event.cancellation_fee', () => {
  test('is JsonLogic, or none', () => {
    expect(valid({ '*': [{ var: 'total' }, 0.1] })).toBe(true);
    expect(valid({
      if: [{ '>=': [{ var: 'days_before_start' }, 30] }, 25, 100],
    })).toBe(true);
    expect(valid(50)).toBe(true);
    expect(valid(33.33)).toBe(true);
    expect(valid(null)).toBe(true);
  });

  test('isn\'t a string, a boolean or a list', () => {
    expect(valid('10%')).toBe(false);
    expect(valid(true)).toBe(false);
    expect(valid([1, 2])).toBe(false);
  });
});
