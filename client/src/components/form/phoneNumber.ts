/**
 * The phone-number rule the forms apply (SPEC §9.1, DR-174): a field the
 * PhoneInput widget answers must hold a number of a possible length for its
 * country, so `+1707` (an area code alone) is rejected and `+17073975275` is
 * taken, and one its country's numbers can be: `+10612345678` (a French
 * `06 12 34 56 78` autofilled into a US field) is rejected, since no US number
 * starts with 0. The widget reports every answer in E.164 form, whose country
 * code gives the country, so `libphonenumber-js` checks it from the value
 * alone, by Google's metadata: the possible lengths, and the general pattern
 * of the country's numbers (any country sharing the dial code). Neither asks
 * whether the number is assigned: a `555` number is still a possible one.
 *
 * Phone fields are found by their widget (`ui:widget: 'PhoneInput'`), since
 * their schema says only `type: 'string'`. The data is walked with rjsf's own
 * `retrieveSchema`, as the review is, and an object's `oneOf`/`anyOf` option is
 * the one rjsf picks for the data, so a conditional phone field the form isn't
 * showing isn't checked. A failure is reported like ajv's `format` errors
 * (`params.format` is `phone`), so the event's own `format` message for the
 * field applies.
 */

import {
  getClosestMatchingOption,
  getDiscriminatorFieldFromSchema,
  getUiOptions,
  retrieveSchema,
  type RJSFSchema,
  type RJSFValidationError,
  type UiSchema,
  type ValidatorType,
} from '@rjsf/utils';
import type { JSONSchema7Definition } from 'json-schema';
import { validatePhoneNumberLength } from 'libphonenumber-js';
import { type CountryCode, Metadata } from 'libphonenumber-js/core';
import metadata from 'libphonenumber-js/min/metadata';

/** The registry name events give the phone widget (`ui:widget`). */
export const PHONE_WIDGET = 'PhoneInput';

/** Each dial code's countries, main one first (`1` → `US`, `CA`, …), by Google's metadata. */
const COUNTRIES_BY_DIAL_CODE = new Map<string, CountryCode[]>(
  Object.entries(metadata.country_calling_codes),
);

/** A dial code's main country (`1` → `US`, `44` → `GB`). */
export function mainCountry(dialCode: string): CountryCode | undefined {
  return COUNTRIES_BY_DIAL_CODE.get(dialCode)?.[0];
}

/** The dial code an E.164 value starts with (dial codes are prefix-free). */
export function dialCodeOf(e164: string): string | undefined {
  for (let length = 1; length <= 3; length += 1) {
    const code = e164.slice(1, 1 + length);
    if (COUNTRIES_BY_DIAL_CODE.has(code)) return code;
  }
  return undefined;
}

const numberingPlans = new Metadata(metadata);
const patterns = new Map<CountryCode, RegExp | undefined>();

/** The general pattern of a country's national numbers (cached). */
function nationalPattern(country: CountryCode): RegExp | undefined {
  if (!patterns.has(country)) {
    numberingPlans.selectNumberingPlan(country);
    // A method of the library's numbering plan its typings leave out.
    const plan = numberingPlans.numberingPlan as
      | { nationalNumberPattern?: () => string | undefined }
      | undefined;
    const source = plan?.nationalNumberPattern?.();
    patterns.set(country, source ? new RegExp(`^(?:${source})$`) : undefined);
  }
  return patterns.get(country);
}

/**
 * Whether an E.164 number has the shape of some country's with its dial code.
 * A dial code of no country (`+800` freephone, `+870` Inmarsat) has no pattern
 * here: its length was checked, which refuses a dial code that doesn't exist.
 */
function fitsItsCountry(e164: string): boolean {
  const code = dialCodeOf(e164);
  if (!code) return true;
  const national = e164.slice(1 + code.length);
  return (COUNTRIES_BY_DIAL_CODE.get(code) ?? []).some((country) => {
    const pattern = nationalPattern(country);
    return !pattern || pattern.test(national);
  });
}

/**
 * Why a value can't be a phone number: `libphonenumber-js`'s length reasons;
 * `NOT_IN_COUNTRY` for one of a possible length no number of its country can
 * be (`+10612345678`: no US number starts with 0); or `NOT_E164` for one not
 * in the E.164 form the widget saves (`+` and digits), such as an imported
 * `(707) 397-5275`, which the widget shows read in its country but saves in
 * E.164 form only once it's entered again.
 */
export type PhoneNumberProblem =
  | NonNullable<ReturnType<typeof validatePhoneNumberLength>>
  | 'NOT_IN_COUNTRY'
  | 'NOT_E164';

/** Why `value` can't be a phone number, or undefined when it can. */
export function phoneNumberProblem(value: string): PhoneNumberProblem | undefined {
  if (!/^\+\d+$/.test(value)) return 'NOT_E164';
  const length = validatePhoneNumberLength(value);
  if (length) return length;
  return fitsItsCountry(value) ? undefined : 'NOT_IN_COUNTRY';
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Whether a field's uiSchema gives it the phone widget. */
export function isPhoneField(uiSchema: unknown): boolean {
  return isRecord(uiSchema) && getUiOptions(uiSchema as UiSchema).widget === PHONE_WIDGET;
}

const hasPhoneFieldCache = new WeakMap<object, boolean>();

/** Whether a uiSchema has a phone field anywhere (cached per uiSchema object). */
function hasPhoneField(uiSchema: Record<string, unknown>): boolean {
  const cached = hasPhoneFieldCache.get(uiSchema);
  if (cached !== undefined) return cached;
  const found =
    isPhoneField(uiSchema) ||
    Object.entries(uiSchema).some(
      ([key, child]) => !key.startsWith('ui:') && isRecord(child) && hasPhoneField(child),
    );
  hasPhoneFieldCache.set(uiSchema, found);
  return found;
}

function phoneError(
  property: string,
  value: string,
  problem: PhoneNumberProblem,
): RJSFValidationError {
  const message = 'must match format "phone"';
  return {
    name: 'format',
    property,
    message,
    // The value, for a message that quotes it: one the widget can't show.
    params: { format: 'phone', reason: problem, value },
    stack: `${property} ${message}`,
  };
}

/**
 * The phone fields in `formData` whose answer isn't a possible phone number,
 * as validation errors with ajv's `property` paths (`.campers.0.phone`).
 */
export function phoneNumberErrors(
  validator: ValidatorType<unknown, RJSFSchema>,
  schema: RJSFSchema,
  uiSchema: UiSchema | undefined,
  formData: unknown,
): RJSFValidationError[] {
  const errors: RJSFValidationError[] = [];
  if (!isRecord(uiSchema) || !hasPhoneField(uiSchema)) return errors;

  const visit = (
    definition: JSONSchema7Definition | undefined,
    ui: unknown,
    data: unknown,
    property: string,
  ) => {
    // A field without a uiSchema of its own has no phone field under it.
    if (!isRecord(ui) || !isRecord(definition)) return;
    if (isPhoneField(ui)) {
      const problem = typeof data === 'string' && data !== '' ? phoneNumberProblem(data) : undefined;
      if (problem) errors.push(phoneError(property, data as string, problem));
      return;
    }
    if (!hasPhoneField(ui)) return;
    // Resolve `$ref`, `dependencies` and `if`/`then` as the form shows them.
    const resolved = retrieveSchema(validator, definition as RJSFSchema, schema, data);
    if (Array.isArray(data)) {
      if (!isRecord(resolved.items)) return;
      data.forEach((item, index) => visit(resolved.items as RJSFSchema, ui.items, item, `${property}.${index}`));
    } else if (isRecord(data)) {
      const properties = { ...resolved.properties };
      // The option of an object's `oneOf`/`anyOf` the form shows for the data.
      const options = (resolved.oneOf ?? resolved.anyOf ?? []).filter(isRecord) as RJSFSchema[];
      if (options.length > 0) {
        const retrieved = options.map((option) => retrieveSchema(validator, option, schema, data));
        const chosen = getClosestMatchingOption(
          validator,
          schema,
          data,
          retrieved,
          0,
          getDiscriminatorFieldFromSchema(resolved),
        );
        Object.assign(properties, retrieved[chosen]?.properties);
      }
      for (const [key, child] of Object.entries(properties)) {
        if (key in data) visit(child, ui[key], data[key], `${property}.${key}`);
      }
    }
  };

  visit(schema, uiSchema, formData, '');
  return errors;
}
