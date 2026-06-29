/**
 * Client-side pricing engine (SPEC §9.2).
 *
 * PARITY IS A HARD REQUIREMENT: this MUST produce results identical to the
 * server's authoritative `calculate_price` (server/camphoric/pricing.py). The
 * server recomputes and returns `serverPricingResults`, which the client adopts
 * after submission — this function exists only for live UX while the registrant
 * edits the form. Any change here must mirror the server (and vice versa), and
 * is guarded by the shared parity fixtures (DR-14, see ./fixtures.ts).
 *
 * Amounts are computed in whole dollars by convention (switch to cents if
 * sub-dollar precision is ever needed).
 */

import type {
  ApiRegister,
  Hash,
  JsonLogicPricing,
  PaymentType,
  PricingResults,
  RegistrationFormData,
} from 'api-types';
import jsonLogic, { type RulesLogic } from 'json-logic-js';
import type { JSONSchema7 } from 'json-schema';
import { dateStringToParts } from 'utils/dates';

/** The mutable json-logic evaluation context shared across components. */
interface PricingContext extends Hash {
  event: Hash;
  registration: Hash;
  pricing: Hash;
  date: DateContext;
  camper?: Hash;
}

interface DateContext {
  epoch: number;
  day: number;
  month: number;
  year: number;
}

function nowAsDateContext(): DateContext {
  const date = new Date();
  return {
    epoch: Math.floor(date.getTime() / 1000),
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

/** Camper schema properties of `type: string, format: date` (converted for logic). */
function getDateProps(schema: JSONSchema7 | undefined): string[] {
  if (!schema?.properties) return [];
  return Object.entries(schema.properties)
    .filter(
      ([, propSchema]) =>
        typeof propSchema === 'object' &&
        propSchema.type === 'string' &&
        propSchema.format === 'date',
    )
    .map(([propName]) => propName);
}

export function calculatePrice(
  config: ApiRegister,
  formData: RegistrationFormData,
  paymentType?: PaymentType,
): PricingResults {
  const { event, pricingLogic, pricing } = config;

  const results: PricingResults = { total: 0, campers: [] };
  const dateContext = nowAsDateContext();

  const data: PricingContext = {
    event: event as unknown as Hash,
    registration: {
      ...formData,
      registration_type: config.registrationType?.name,
      created_at: dateContext,
    },
    pricing,
    date: dateContext,
  };

  const camperSchema = config.dataSchema.definitions?.camper;
  const camperDateProps = getDateProps(
    typeof camperSchema === 'object' ? camperSchema : undefined,
  );

  // Registration-level components run once; each result feeds back into the
  // context so later components (and camper components) can reference it.
  applyRegistrationComponents(pricingLogic.registration, data, results);

  // Camper-level components run per camper; numeric/boolean results accumulate
  // into the registration-level totals (a running total across campers).
  formData.campers.forEach((camper, index) => {
    const camperResults: Hash = {};
    const camperData: Hash = { ...camper, index };
    camperDateProps
      .filter((prop) => camperData[prop])
      .forEach((prop) => {
        camperData[prop] = dateStringToParts(camperData[prop] as string);
      });
    data.camper = camperData;

    pricingLogic.camper.forEach((component) => {
      const value: unknown = jsonLogic.apply(component.exp as RulesLogic, data);
      camperResults[component.var] = value;
      if (typeof value === 'number' || typeof value === 'boolean') {
        const subtotal = asNumber(results[component.var]) + Number(value);
        results[component.var] = subtotal;
        data[component.var] = value;
      }
    });

    results.campers.push(camperResults);
  });

  // Electronic-payment handling fee — added only when NOT paying by check.
  if (event.epayment_handling && paymentType !== 'Check') {
    const handling = asNumber(results.total) * (event.epayment_handling / 100);
    results.handling = handling;
    results.total = asNumber(results.total) + handling;
  }

  return results;
}

function applyRegistrationComponents(
  components: JsonLogicPricing,
  data: PricingContext,
  results: PricingResults,
): void {
  components.forEach((component) => {
    const value: unknown = jsonLogic.apply(component.exp as RulesLogic, data);
    results[component.var] = typeof value === 'number' && Number.isNaN(value) ? 0 : asNumber(value);
    data[component.var] = value;
  });
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && !Number.isNaN(value) ? value : 0;
}
