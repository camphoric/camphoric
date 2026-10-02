import { describe, expect, it } from 'vitest';

import { handlingFee } from '../handlingFee';
import { handlingFeeFixtures } from './handlingFee.fixtures';

describe('handlingFee — rounding parity with the server', () => {
  handlingFeeFixtures.forEach(({ amount, percent, fee }) => {
    it(`${percent}% of $${amount} is $${fee}`, () => {
      expect(handlingFee(amount, percent)).toBe(fee);
    });
  });

  it('is nothing without a percent', () => {
    expect(handlingFee(100, 0)).toBe(0);
  });
});
