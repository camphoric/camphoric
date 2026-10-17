/**
 * The handling fee's rounding cases (GitHub #622; SPEC §9.7). The same cases
 * are in server/tests/test_pricing.py (TestHandlingFeeRounding); keep the two
 * in step.
 */

export interface HandlingFeeFixture {
  amount: number;
  percent: number;
  fee: number;
}

export const handlingFeeFixtures: HandlingFeeFixture[] = [
  // 2.5% of an odd number of dollars is exactly half a cent, which rounds up.
  { amount: 1, percent: 2.5, fee: 0.03 },
  { amount: 5, percent: 2.5, fee: 0.13 },
  { amount: 7, percent: 2.5, fee: 0.18 },
  { amount: 25, percent: 2.5, fee: 0.63 },
  // 102.27 × 2.5% = 2.55675, so 2.56.
  { amount: 102.27, percent: 2.5, fee: 2.56 },
  { amount: 420, percent: 3, fee: 12.6 },
  { amount: 0, percent: 3, fee: 0 },
];
