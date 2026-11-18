/**
 * The phone-number rule the forms apply (SPEC §9.1, DR-174): a field the
 * PhoneInput widget answers must hold a number of a possible length for its
 * country, so `+1707` (an area code alone) is rejected and `+17073975275` is
 * taken. The widget reports every answer in E.164 form, whose country code
 * gives the country, so `libphonenumber-js` checks the length from the value
 * alone. It checks the length only, not whether the number is assigned: a
 * `555` number is still a possible one.
 *
 * Phone fields are found by their widget (`ui:widget: 'PhoneInput'`), since
 * their schema says only `type: 'string'`. The data is walked with rjsf's own
 * `retrieveSchema`, as the review is, so a conditional phone field the form
 * isn't showing isn't checked. A failure is reported like ajv's `format` errors
 * (`params.format` is `phone`), so the event's own `format` message for the
 * field applies.
 */

import {
  getUiOptions,
  retrieveSchema,
  type RJSFSchema,
  type RJSFValidationError,
  type UiSchema,
  type ValidatorType,
} from '@rjsf/utils';
import type { JSONSchema7Definition } from 'json-schema';
import { validatePhoneNumberLength } from 'libphonenumber-js';

/** The registry name events give the phone widget (`ui:widget`). */
export const PHONE_WIDGET = 'PhoneInput';

/**
 * Why a value can't be a phone number: `libphonenumber-js`'s reasons, or
 * `NOT_E164` for one not in the E.164 form the widget saves (`+` and digits),
 * such as an imported `(707) 397-5275`, which the widget shows read in its
 * country but saves in E.164 form only once it's entered again.
 */
export type PhoneNumberProblem =
  | NonNullable<ReturnType<typeof validatePhoneNumberLength>>
  | 'NOT_E164';

/** Why `value` can't be a phone number, or undefined when it can. */
export function phoneNumberProblem(value: string): PhoneNumberProblem | undefined {
  if (!/^\+\d+$/.test(value)) return 'NOT_E164';
  return validatePhoneNumberLength(value);
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

function phoneError(property: string, problem: PhoneNumberProblem): RJSFValidationError {
  const message = 'must match format "phone"';
  return {
    name: 'format',
    property,
    message,
    params: { format: 'phone', reason: problem },
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
      if (problem) errors.push(phoneError(property, problem));
      return;
    }
    if (!hasPhoneField(ui)) return;
    // Resolve `$ref`, `dependencies` and `if`/`then` as the form shows them.
    const resolved = retrieveSchema(validator, definition as RJSFSchema, schema, data);
    if (Array.isArray(data)) {
      if (!isRecord(resolved.items)) return;
      data.forEach((item, index) => visit(resolved.items as RJSFSchema, ui.items, item, `${property}.${index}`));
    } else if (isRecord(data)) {
      for (const [key, child] of Object.entries(resolved.properties ?? {})) {
        if (key in data) visit(child, ui[key], data[key], `${property}.${key}`);
      }
    }
  };

  visit(schema, uiSchema, formData, '');
  return errors;
}
