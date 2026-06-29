import type { ApiEvent, ApiRegister, RegistrationFormData } from 'api-types';
import { describe, expect, it } from 'vitest';

import { calculatePrice } from './calculatePrice';
import { pricingFixtures } from './fixtures';

describe('calculatePrice — golden parity fixtures', () => {
  pricingFixtures.forEach((fixture) => {
    it(fixture.name, () => {
      const results = calculatePrice(fixture.config, fixture.formData, fixture.paymentType);

      // Per-camper breakdown is exact.
      expect(results.campers).toEqual(fixture.expectedCampers);

      // Money fields compared with cent tolerance (float arithmetic).
      Object.entries(fixture.expectedMoney).forEach(([key, value]) => {
        expect(results[key]).toBeCloseTo(value as number, 2);
      });

      // The handling fee must be absent unless the fixture expects it.
      if (fixture.expectedMoney.handling === undefined) {
        expect(results.handling).toBeUndefined();
      }
    });
  });
});

describe('calculatePrice — mechanics', () => {
  const baseEvent = (overrides: Partial<ApiEvent> = {}): ApiEvent =>
    ({
      id: 1,
      name: 'E',
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
    });

  it('converts camper date props (YYYY-MM-DD) to {year, month, day} for logic', () => {
    const config: ApiRegister = {
      dataSchema: {
        definitions: {
          camper: {
            type: 'object',
            properties: { birthdate: { type: 'string', format: 'date' } },
          },
        },
      },
      uiSchema: {},
      preSubmitTemplate: '',
      templateVars: {},
      event: baseEvent(),
      pricing: {},
      pricingLogic: {
        registration: [],
        camper: [
          { var: 'birth_year', exp: { var: 'camper.birthdate.year' } },
          { var: 'birth_month', exp: { var: 'camper.birthdate.month' } },
        ],
      },
    };
    const formData: RegistrationFormData = { campers: [{ birthdate: '2015-06-01' }] };

    const results = calculatePrice(config, formData);

    expect(results.campers[0]).toEqual({ birth_year: 2015, birth_month: 6 });
    // Numeric camper results accumulate into the registration-level totals.
    expect(results.birth_year).toBe(2015);
  });

  it('feeds a registration-level result into later camper logic', () => {
    const config: ApiRegister = {
      dataSchema: { definitions: { camper: { type: 'object', properties: {} } } },
      uiSchema: {},
      preSubmitTemplate: '',
      templateVars: {},
      event: baseEvent({ pricing: { base: 10 } }),
      pricing: { base: 10 },
      pricingLogic: {
        registration: [{ var: 'surcharge', exp: { var: 'pricing.base' } }],
        // Each camper's fee references the registration-level `surcharge`.
        camper: [{ var: 'total', exp: { '+': [{ var: 'surcharge' }, 5] } }],
      },
    };
    const formData: RegistrationFormData = { campers: [{}, {}] };

    const results = calculatePrice(config, formData);

    expect(results.surcharge).toBe(10);
    // total = (10 + 5) per camper, accumulated across 2 campers = 30
    expect(results.total).toBe(30);
  });
});
