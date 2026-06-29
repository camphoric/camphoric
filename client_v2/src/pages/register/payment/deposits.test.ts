import type { PricingResults } from 'api-types';
import { describe, expect, it } from 'vitest';

import { applyDeposit, NO_DEPOSIT, parseDeposit } from './deposits';

describe('parseDeposit', () => {
  it('parses a deposit option JSON string', () => {
    const value = JSON.stringify({ name: 'half', logic: { '*': [{ var: 'total' }, 0.5] } });
    expect(parseDeposit(value)).toEqual({ name: 'half', logic: { '*': [{ var: 'total' }, 0.5] } });
  });

  it('falls back to NO_DEPOSIT for empty or invalid input', () => {
    expect(parseDeposit(undefined)).toEqual(NO_DEPOSIT);
    expect(parseDeposit('')).toEqual(NO_DEPOSIT);
    expect(parseDeposit('not json')).toEqual(NO_DEPOSIT);
    expect(parseDeposit('{"name":"x"}')).toEqual(NO_DEPOSIT); // missing logic
  });
});

describe('applyDeposit', () => {
  const totals: PricingResults = { total: 450, campers: [] };

  it('applies the deposit logic to the pricing results', () => {
    expect(applyDeposit({ name: 'full', logic: { var: 'total' } }, totals)).toBe(450);
    expect(applyDeposit({ name: 'half', logic: { '*': [{ var: 'total' }, 0.5] } }, totals)).toBe(225);
    expect(applyDeposit({ name: 'flat', logic: 50 }, totals)).toBe(50);
  });

  it('falls back to the full total when the logic is not numeric', () => {
    expect(applyDeposit({ name: 'bad', logic: { var: 'missing' } }, totals)).toBe(450);
  });
});
