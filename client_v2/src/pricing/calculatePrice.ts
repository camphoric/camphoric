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
  AppliedPromo,
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

/** A promo code's discount line (§9.2; §15, DR-67), labelled with the code's label. */
export const PROMO_LINE = 'promo';

export function calculatePrice(
  config: ApiRegister,
  formData: RegistrationFormData,
  paymentType?: PaymentType,
  promo?: AppliedPromo | null,
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
  const camperContexts: Hash[] = [];
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
    camperContexts.push(camperData);
  });

  delete data.camper;
  if (promo) applyPromo(promo, data, results, camperContexts);

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

/**
 * Subtracts the promo code's discount from the total (§9.2; §15, DR-67). MUST
 * match `_apply_promo` in server/camphoric/pricing.py. A registration-scoped
 * code sees the registration's lines (camper lines summed); a camper-scoped one
 * is worked out in each camper's context, with that camper's own lines, and
 * shows on the camper's breakdown too.
 */
function applyPromo(
  promo: AppliedPromo,
  data: PricingContext,
  results: PricingResults,
  camperContexts: Hash[],
): void {
  let remaining = Math.max(0, asNumber(results.total));
  let discount = 0;
  if (promo.scope === 'camper') {
    results.campers.forEach((camperResults, index) => {
      const camperTotal = camperResults.total;
      const cap = isAmount(camperTotal) ? Math.min(camperTotal, remaining) : remaining;
      const camperDiscount = promoDiscount(
        promo.pricingLogic,
        { ...data, ...camperResults, camper: camperContexts[index] },
        Math.max(0, cap),
      );
      camperResults[PROMO_LINE] = negated(camperDiscount);
      if (isAmount(camperTotal)) camperResults.total = camperTotal - camperDiscount;
      remaining -= camperDiscount;
      discount += camperDiscount;
    });
  } else {
    const { campers: _campers, ...lines } = results;
    discount = promoDiscount(promo.pricingLogic, { ...data, ...lines }, remaining);
  }
  results[PROMO_LINE] = negated(discount);
  results.total = asNumber(results.total) - discount;
}

/** The discount the logic works out: never negative, and never more than `cap`. */
function promoDiscount(logic: unknown, data: Hash, cap: number): number {
  const value: unknown = jsonLogic.apply(logic as RulesLogic, data);
  return isAmount(value) ? Math.max(0, Math.min(value, cap)) : 0;
}

/** A discount as its (negative) price line, without a negative zero. */
function negated(discount: number): number {
  return discount ? -discount : 0;
}

function isAmount(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && !Number.isNaN(value) ? value : 0;
}
