/**
 * Money helpers. Amounts are computed in whole dollars by convention and
 * formatted to two decimals for display (SPEC §10). English/USD only (DR-18).
 */

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a dollar amount as USD, e.g. 400 -> "$400.00". */
export function formatMoney(amount: number): string {
  return usdFormatter.format(Number.isFinite(amount) ? amount : 0);
}
