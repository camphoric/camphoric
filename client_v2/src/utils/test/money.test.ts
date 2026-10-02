import { describe, expect, it } from 'vitest';

import { formatMoney, roundHalfUp, roundMoney } from '../money';

describe('formatMoney', () => {
  it('formats whole dollars to two decimals', () => {
    expect(formatMoney(400)).toBe('$400.00');
    expect(formatMoney(0)).toBe('$0.00');
  });

  it('formats fractional amounts', () => {
    expect(formatMoney(12.5)).toBe('$12.50');
  });

  it('coerces the string decimals the API returns for money fields', () => {
    expect(formatMoney('675.00')).toBe('$675.00');
    expect(formatMoney('12.5')).toBe('$12.50');
    expect(formatMoney('0')).toBe('$0.00');
  });

  it('guards against non-finite input', () => {
    expect(formatMoney(NaN)).toBe('$0.00');
    expect(formatMoney(Infinity)).toBe('$0.00');
    expect(formatMoney('')).toBe('$0.00');
    expect(formatMoney('abc')).toBe('$0.00');
  });
});

describe('roundMoney', () => {
  // The same cases are in server/tests/test_pricing.py (money_fmt).
  it('rounds a half cent up, going by the amount as written', () => {
    // The floats for 2.675 and 1.005 are just under the written half cent.
    expect(roundMoney(2.675)).toBe(2.68);
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(0.125)).toBe(0.13);
  });

  it('rounds a negative half cent away from zero', () => {
    expect(roundMoney(-2.675)).toBe(-2.68);
    expect(Object.is(roundMoney(-0.001), 0)).toBe(true);
  });

  it('leaves whole cents and non-finite amounts alone', () => {
    expect(roundMoney(7)).toBe(7);
    expect(roundMoney(104.83)).toBe(104.83);
    expect(roundMoney(Infinity)).toBe(Infinity);
  });
});

describe('roundHalfUp', () => {
  it('rounds to whole numbers too', () => {
    expect(roundHalfUp(17.5, 0)).toBe(18);
    expect(roundHalfUp(255.675, 0)).toBe(256);
    expect(roundHalfUp(1e-7, 2)).toBe(0);
  });
});
