/**
 * Deposit options for the payment step (SPEC §7.2). Each deposit option is a
 * JSON string of `{ name, logic }`; selecting one recomputes the amount due by
 * applying its JSON-logic expression to the pricing results.
 */

import type { PricingResults } from 'api-types';
import jsonLogic, { type RulesLogic } from 'json-logic-js';

export interface ParsedDeposit {
  name: string;
  logic: RulesLogic;
}

/** A no-op deposit (full amount due), used when nothing is selected/parseable. */
export const NO_DEPOSIT: ParsedDeposit = { name: 'none', logic: 0 };

export function parseDeposit(value: string | undefined): ParsedDeposit {
  if (!value) return NO_DEPOSIT;
  try {
    const parsed = JSON.parse(value) as Partial<ParsedDeposit>;
    if (parsed && typeof parsed.name === 'string' && parsed.logic !== undefined) {
      return { name: parsed.name, logic: parsed.logic };
    }
  } catch {
    // fall through to NO_DEPOSIT
  }
  return NO_DEPOSIT;
}

/** Amount due after applying the deposit's logic to the pricing results. */
export function applyDeposit(deposit: ParsedDeposit, pricingResults: PricingResults): number {
  const result: unknown = jsonLogic.apply(deposit.logic, pricingResults);
  return typeof result === 'number' ? result : (pricingResults.total ?? 0);
}
