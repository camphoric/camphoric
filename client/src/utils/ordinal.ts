/**
 * English ordinal for a positive integer: 1 -> "1st", 2 -> "2nd", 3 -> "3rd",
 * 4 -> "4th", 11 -> "11th", 21 -> "21st" … Used for the "Nth Camper" labels
 * (SPEC §9.1). The spec specifies numeral ordinals (the v4 reference spelled
 * 1–9 as words; numerals match the spec).
 */
export function ordinal(n: number): string {
  const onesDigit = n % 10;
  const tensDigit = n % 100;
  if (onesDigit === 1 && tensDigit !== 11) return `${n}st`;
  if (onesDigit === 2 && tensDigit !== 12) return `${n}nd`;
  if (onesDigit === 3 && tensDigit !== 13) return `${n}rd`;
  return `${n}th`;
}
