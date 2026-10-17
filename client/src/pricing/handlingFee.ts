/**
 * The e-payment handling fee on an invoice paid online (SPEC §9.7; §15, DR-88):
 * `percent` of `amount`, to the cent, a half cent up. It's worked out in cents
 * (amount × percent), where a fee of exactly half a cent (2.5% of an odd number
 * of dollars) is exact.
 *
 * The server charges the fee; the admin uses this only to suggest one
 * ("Calculate"). It MUST match `handling_fee` in server/camphoric/pricing.py:
 * both run the fixtures in ./test/handlingFee.fixtures.ts (DR-14).
 */

import { roundHalfUp } from 'utils/money';

export function handlingFee(amount: number, percent: number): number {
  if (!percent || amount <= 0) return 0;
  return roundHalfUp(amount * percent, 0) / 100;
}
