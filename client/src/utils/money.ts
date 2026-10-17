/**
 * Money helpers. Amounts are formatted to two decimals for display (SPEC §10)
 * and rounded to the cent a half cent up, like the server (§9.2). English/USD
 * only (DR-18).
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

/**
 * Round to `places` decimals, a half up (away from zero), going by the number
 * as written: 2.675 rounds to 2.68, though the float stored for it is just
 * under. `Math.round(x * 100) / 100` and `toFixed` go by the float instead.
 */
export function roundHalfUp(value: number, places: number): number {
  if (!Number.isFinite(value)) return value;
  const magnitude = Math.abs(value);
  const text = String(magnitude);
  // Shift the decimal point in the text, where a written half is exact.
  const shifted = text.includes('e') ? magnitude * 10 ** places : Number(`${text}e${places}`);
  const rounded = Number(`${Math.round(shifted)}e-${places}`);
  return value < 0 && rounded ? -rounded : rounded;
}

/**
 * An amount rounded to the cent, a half cent up. MUST match `money_fmt` in
 * server/camphoric/pricing.py (§9.2).
 */
export function roundMoney(amount: number): number {
  return roundHalfUp(amount, 2);
}
