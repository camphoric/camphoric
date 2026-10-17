/**
 * Pricing parity (§9.2; §15, DR-14): `calculatePrice` gives each case in the
 * shared fixtures exactly the results it expects, as the server's
 * `calculate_price` does (server/tests/test_pricing_parity.py). The fixtures
 * live with the server's tests, which run without the client, and are read
 * when the test runs, so the client builds without them.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  ApiRegister,
  Hash,
  JsonLogicPricing,
  PricingResults,
  PromoScope,
} from 'api-types';
import type { JSONSchema7 } from 'json-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { calculatePrice } from '../calculatePrice';

interface ParityFixture {
  name: string;
  /** The instant it's priced at (UTC). */
  now: string;
  event: {
    pricing: Hash<number>;
    registrationPricingLogic: JsonLogicPricing;
    camperPricingLogic: JsonLogicPricing;
    camperSchema?: JSONSchema7;
    epaymentHandling?: number;
  };
  /** The registration's attributes, without its campers. */
  registration: Hash;
  campers: Hash[];
  promo?: { scope: PromoScope; pricingLogic: unknown };
  expected: PricingResults;
}

const FIXTURES = join(import.meta.dirname, '../../../../server/tests/data/pricing_parity.json');

const { fixtures } = JSON.parse(readFileSync(FIXTURES, 'utf-8')) as { fixtures: ParityFixture[] };

/** The register config the fixture's event gives. */
function registerConfig({ event }: ParityFixture): ApiRegister {
  return {
    dataSchema: {
      definitions: { camper: event.camperSchema ?? { type: 'object', properties: {} } },
    },
    uiSchema: {},
    preSubmitTemplate: '',
    templateVars: {},
    event: { is_open: true, epayment_handling: event.epaymentHandling ?? 0 },
    pricing: event.pricing,
    pricingLogic: { registration: event.registrationPricingLogic, camper: event.camperPricingLogic },
  };
}

function priceAt(fixture: ParityFixture): PricingResults {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(fixture.now));
  const promo = fixture.promo && { code: 'PROMO', label: 'Promo', ...fixture.promo };
  return calculatePrice(
    registerConfig(fixture),
    { ...fixture.registration, campers: fixture.campers },
    promo,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('calculatePrice — parity with the server', () => {
  it('has fixtures', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  fixtures.forEach((fixture) => {
    it(fixture.name, () => {
      expect(priceAt(fixture)).toStrictEqual(fixture.expected);
    });
  });
});
