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

/**
 * Format a dollar amount as USD, e.g. 400 -> "$400.00". Accepts the string
 * decimals the API returns for money fields (DRF `DecimalField` serializes to a
 * string, e.g. `"675.00"`) as well as plain numbers; non-numeric input formats
 * as `$0.00`.
 */
export function formatMoney(amount: number | string): string {
  const value = typeof amount === 'number' ? amount : Number(amount);
  return usdFormatter.format(Number.isFinite(value) ? value : 0);
}
