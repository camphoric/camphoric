/** Pricing results and overrides for the FeeBreakdown tests and stories: one Lark camper. */

import type { ApiPricingOverride, JsonLogicPricing, PricingResults } from 'api-types';

export const CAMPER_LOGIC: JsonLogicPricing = [
  { var: 'tuition', label: 'Tuition', exp: 0 },
  { var: 'meals', label: 'Meals', exp: 0 },
  { var: 'parking', label: 'Parking', exp: 0 },
  { var: 'total', exp: 0 },
];

/** Tuition overridden from $920 to $500. */
export const OVERRIDDEN: PricingResults = {
  tuition: 500,
  meals: 505,
  parking: 0,
  total: 1005,
  campers: [],
  overridden: { tuition: 920 },
};

export const TUITION_OVERRIDE: ApiPricingOverride = {
  id: 2,
  registration: 5,
  camper: 17,
  var: 'tuition',
  amount: '500.00',
  reason: 'Instructor’s kid',
  created_by_name: 'Reggie Registrar',
  applied: true,
  created_at: '2026-09-26T18:00:00Z',
  updated_at: '2026-09-26T18:00:00Z',
};

/** An override of a line the event's pricing no longer has. */
export const STALE_OVERRIDE: ApiPricingOverride = {
  ...TUITION_OVERRIDE,
  id: 3,
  var: 'name_badge',
  amount: '0.00',
  reason: 'Badge comped',
  applied: false,
};

export const REGISTRATION_LOGIC: JsonLogicPricing = [
  { var: 'donation', label: 'Donation', exp: 0 },
  { var: 'total', exp: 0 },
];

/** A PayPal registration whose handling fee was waived. */
export const HANDLING_WAIVED: PricingResults = {
  donation: 25,
  handling: 0,
  total: 2455,
  campers: [],
  overridden: { handling: 60.75 },
};

export const HANDLING_OVERRIDE: ApiPricingOverride = {
  ...TUITION_OVERRIDE,
  id: 4,
  camper: null,
  var: 'handling',
  amount: '0.00',
  reason: 'Paid by check after all',
};
