/**
 * Golden pricing fixtures (SPEC §9.2, DR-14).
 *
 * These are the seed of the shared parity suite: the same inputs → expected
 * `PricingResults` should hold for BOTH `calculatePrice` (client, here) and the
 * server's `calculate_price`. Today they exercise the client engine; wiring an
 * equivalent server-side test that runs these same cases is tracked as a
 * backend coordination item (DR-14, Appendix A.2). Keep the two in lockstep:
 * any pricing change updates these fixtures and both engines.
 */

import type {
  ApiRegister,
  AppliedPromo,
  PaymentType,
  PromoScope,
  RegistrationFormData,
} from 'api-types';

export interface PricingFixture {
  name: string;
  config: ApiRegister;
  formData: RegistrationFormData;
  paymentType?: PaymentType;
  /** An applied promo code (§15, DR-67). */
  promo?: AppliedPromo;
  /** Expected money fields (compared with 2-decimal tolerance). */
  expectedMoney: { total: number; handling?: number; [subtotal: string]: number | undefined };
  /** Expected per-camper breakdown (compared exactly). */
  expectedCampers: Record<string, unknown>[];
}

/**
 * Pricing model used by the first fixtures:
 *   - registration component `total` seeds the total with a flat registration
 *     fee (50);
 *   - camper component `tuition` charges the camp fee (200) per camper and
 *     accumulates into `results.tuition`;
 *   - camper component `total` adds each camper's tuition onto the running
 *     `results.total` (so total = 50 + 200·N).
 */
function makeConfig(epaymentHandling: number): ApiRegister {
  return {
    dataSchema: { definitions: { camper: { type: 'object', properties: {} } } },
    uiSchema: {},
    preSubmitTemplate: '',
    templateVars: {},
    event: { is_open: true, epayment_handling: epaymentHandling },
    pricing: { camp_fee: 200, registration_fee: 50 },
    pricingLogic: {
      registration: [{ var: 'total', exp: { var: 'pricing.registration_fee' } }],
      camper: [
        { var: 'tuition', exp: { var: 'pricing.camp_fee' } },
        { var: 'total', exp: { var: 'tuition' } },
      ],
    },
  };
}

const twoCampers: RegistrationFormData = { campers: [{}, {}] };

/**
 * Pricing with credits, for the no-negative-totals cases (§15, DR-68):
 *   - registration component `total` is the registration fee (50) less the
 *     registration's `credit`;
 *   - each camper's `tuition` is the camp fee (200), or 0 for a `free` camper,
 *     and their `total` is that less a campership (100).
 */
function makeCreditConfig(epaymentHandling: number): ApiRegister {
  return {
    ...makeConfig(epaymentHandling),
    pricing: { camp_fee: 200, registration_fee: 50, campership: 100 },
    pricingLogic: {
      registration: [
        {
          var: 'total',
          exp: { '-': [{ var: 'pricing.registration_fee' }, { var: ['registration.credit', 0] }] },
        },
      ],
      camper: [
        { var: 'tuition', exp: { if: [{ var: 'camper.free' }, 0, { var: 'pricing.camp_fee' }] } },
        { var: 'campership', exp: { var: 'pricing.campership' } },
        { var: 'total', exp: { '-': [{ var: 'tuition' }, { var: 'campership' }] } },
      ],
    },
  };
}

function promo(pricingLogic: unknown, scope: PromoScope = 'registration'): AppliedPromo {
  return { code: 'PROMO', label: 'Promo', scope, pricingLogic };
}

const undiscountedCampers = [
  { tuition: 200, total: 200 },
  { tuition: 200, total: 200 },
];

export const pricingFixtures: PricingFixture[] = [
  {
    name: 'electronic payment adds the handling fee (3%)',
    config: makeConfig(3),
    formData: twoCampers,
    // total = 50 + 200·2 = 450; handling = 450·3% = 13.5; total = 463.5
    expectedMoney: { total: 463.5, handling: 13.5, tuition: 400 },
    expectedCampers: [
      { tuition: 200, total: 200 },
      { tuition: 200, total: 200 },
    ],
  },
  {
    name: 'paying by check omits the handling fee',
    config: makeConfig(3),
    formData: twoCampers,
    paymentType: 'Check',
    expectedMoney: { total: 450, tuition: 400 },
    expectedCampers: [
      { tuition: 200, total: 200 },
      { tuition: 200, total: 200 },
    ],
  },
  {
    name: 'no campers yields just the registration-level total',
    config: makeConfig(0),
    formData: { campers: [] },
    expectedMoney: { total: 50 },
    expectedCampers: [],
  },
  // Promo codes (DR-67). The same cases are in server/tests/test_pricing.py
  // (TestPromoCodePricing); keep the two in step.
  {
    name: 'promo: a flat discount comes off the total',
    config: makeConfig(0),
    formData: twoCampers,
    promo: promo(30),
    expectedMoney: { total: 420, promo: -30, tuition: 400 },
    expectedCampers: undiscountedCampers,
  },
  {
    name: 'promo: a percentage of a summed line',
    config: makeConfig(0),
    formData: twoCampers,
    promo: promo({ '*': [{ var: 'tuition' }, 0.4] }),
    expectedMoney: { total: 290, promo: -160 },
    expectedCampers: undiscountedCampers,
  },
  {
    name: 'promo: the discount is capped at the total',
    config: makeConfig(0),
    formData: twoCampers,
    promo: promo(1000),
    expectedMoney: { total: 0, promo: -450 },
    expectedCampers: undiscountedCampers,
  },
  {
    name: 'promo: a negative discount is none',
    config: makeConfig(0),
    formData: twoCampers,
    promo: promo({ '-': [0, 10] }),
    expectedMoney: { total: 450, promo: 0 },
    expectedCampers: undiscountedCampers,
  },
  {
    name: 'promo: handling is on the discounted total',
    config: makeConfig(3),
    formData: twoCampers,
    promo: promo(30),
    // 450 − 30 = 420; handling = 420·3% = 12.6
    expectedMoney: { total: 432.6, promo: -30, handling: 12.6 },
    expectedCampers: undiscountedCampers,
  },
  {
    name: 'promo: a per-camper discount, capped at each camper’s total',
    config: makeConfig(0),
    formData: twoCampers,
    promo: promo(
      { if: [{ '==': [{ var: 'camper.index' }, 0] }, 1000, { '*': [{ var: 'tuition' }, 0.5] }] },
      'camper',
    ),
    expectedMoney: { total: 150, promo: -300 },
    expectedCampers: [
      { tuition: 200, total: 0, promo: -200 },
      { tuition: 200, total: 100, promo: -100 },
    ],
  },
  // No negative totals (DR-68). The same cases are in server/tests/test_pricing.py
  // (TestNoNegativeTotals); keep the two in step.
  {
    name: 'a camper’s total is never below 0',
    config: makeCreditConfig(0),
    formData: { campers: [{ free: true }, {}] },
    // The free camper's campership leaves them at 0, not −100: 50 + 0 + 100.
    expectedMoney: { total: 150, tuition: 200, campership: 200 },
    expectedCampers: [
      { tuition: 0, campership: 100, total: 0 },
      { tuition: 200, campership: 100, total: 100 },
    ],
  },
  {
    name: 'the registration’s total is never below 0, nor is handling',
    config: makeCreditConfig(3),
    formData: { credit: 500, campers: [{}, {}] },
    // 50 − 500 + 100 + 100 = −250, so 0; handling on 0 is 0.
    expectedMoney: { total: 0, handling: 0 },
    expectedCampers: [
      { tuition: 200, campership: 100, total: 100 },
      { tuition: 200, campership: 100, total: 100 },
    ],
  },
  {
    name: 'a registration-level credit still comes off the campers’ totals',
    config: makeCreditConfig(0),
    formData: { credit: 100, campers: [{}, {}] },
    // Only the sum is floored, not the registration's own line: 50 − 100 + 200.
    expectedMoney: { total: 150 },
    expectedCampers: [
      { tuition: 200, campership: 100, total: 100 },
      { tuition: 200, campership: 100, total: 100 },
    ],
  },
];
