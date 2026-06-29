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

import type { ApiEvent, ApiRegister, PaymentType, RegistrationFormData } from 'api-types';

export interface PricingFixture {
  name: string;
  config: ApiRegister;
  formData: RegistrationFormData;
  paymentType?: PaymentType;
  /** Expected money fields (compared with 2-decimal tolerance). */
  expectedMoney: { total: number; handling?: number; [subtotal: string]: number | undefined };
  /** Expected per-camper breakdown (compared exactly). */
  expectedCampers: Record<string, unknown>[];
}

/** Build a type-complete ApiEvent with sensible defaults for fixtures. */
function makeEvent(overrides: Partial<ApiEvent>): ApiEvent {
  return {
    id: 1,
    name: 'Test Event',
    organization: 1,
    start: '2026-07-01',
    end: '2026-07-05',
    registration_start: '2026-01-01T00:00:00Z',
    registration_end: '2026-06-30T00:00:00Z',
    default_stay_length: 4,
    camper_schema: {},
    camper_admin_schema: {},
    registration_schema: {},
    registration_ui_schema: {},
    registration_admin_schema: {},
    payment_schema: {},
    deposit_schema: {},
    pricing: {},
    camper_pricing_logic: [],
    registration_pricing_logic: [],
    registration_template_vars: {},
    confirmation_page_template: '',
    confirmation_email_subject: '',
    confirmation_email_template: '',
    confirmation_email_from: '',
    paypal_enabled: false,
    paypal_client_id: '',
    epayment_handling: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
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
  const event = makeEvent({
    epayment_handling: epaymentHandling,
    pricing: { camp_fee: 200, registration_fee: 50 },
  });
  return {
    dataSchema: { definitions: { camper: { type: 'object', properties: {} } } },
    uiSchema: {},
    preSubmitTemplate: '',
    templateVars: {},
    event,
    pricing: event.pricing,
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
];
