import { describe, expect, it } from 'vitest';

import { formatMoney } from './money';

describe('formatMoney', () => {
  it('formats whole dollars to two decimals', () => {
    expect(formatMoney(400)).toBe('$400.00');
    expect(formatMoney(0)).toBe('$0.00');
  });

  it('formats fractional amounts', () => {
    expect(formatMoney(12.5)).toBe('$12.50');
  });

  it('guards against non-finite input', () => {
    expect(formatMoney(NaN)).toBe('$0.00');
    expect(formatMoney(Infinity)).toBe('$0.00');
  });
});
