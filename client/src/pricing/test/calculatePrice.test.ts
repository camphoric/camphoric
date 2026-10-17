import type { ApiRegister, RegisterConfigEvent, RegistrationFormData } from 'api-types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { calculatePrice } from '../calculatePrice';

// The engine's results, case by case, are in the parity fixtures shared with
// the server (./pricingParity.test.ts; §15, DR-14).
describe('calculatePrice — mechanics', () => {
  const baseEvent = (overrides: Partial<RegisterConfigEvent> = {}): RegisterConfigEvent => ({
    is_open: true,
    epayment_handling: 0,
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
      event: baseEvent(),
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

  describe('in a browser west of UTC', () => {
    const browserZone = process.env.TZ;

    afterEach(() => {
      if (browserZone === undefined) delete process.env.TZ;
      else process.env.TZ = browserZone;
      vi.useRealTimers();
    });

    it('takes the date in UTC, as the server does (§15, DR-128)', () => {
      process.env.TZ = 'America/Los_Angeles';
      vi.useFakeTimers({ toFake: ['Date'] });
      // 7:30 PM on Feb 28 in Los Angeles.
      vi.setSystemTime(new Date('2026-03-01T03:30:00Z'));
      const config: ApiRegister = {
        dataSchema: { definitions: { camper: { type: 'object', properties: {} } } },
        uiSchema: {},
        preSubmitTemplate: '',
        templateVars: {},
        event: baseEvent(),
        pricing: {},
        pricingLogic: {
          registration: [
            { var: 'day', exp: { var: 'date.day' } },
            { var: 'month', exp: { var: 'date.month' } },
            { var: 'created_day', exp: { var: 'registration.created_at.day' } },
          ],
          camper: [],
        },
      };

      const results = calculatePrice(config, { campers: [] });

      expect([results.month, results.day, results.created_day]).toEqual([3, 1, 1]);
    });
  });
});
