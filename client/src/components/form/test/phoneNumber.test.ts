import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { describe, expect, it } from 'vitest';

import { builtInTemplate } from '../errorMessages';
import { createMessagingValidator } from '../messagingValidator';
import { phoneNumberProblem } from '../phoneNumber';
import { collectFieldPaths } from '../schemaPaths';

describe('phoneNumberProblem', () => {
  it.each([
    '+17073975275', // North America: 10 digits after the +1
    '+15555550101', // a possible length, though not an assigned number
    '+442079460958', // UK
    '+4930123456', // Germany, whose numbers vary in length
    '+49301234',
    '+611234567890', // Australia
  ])('takes %j', (phone) => {
    expect(phoneNumberProblem(phone)).toBeUndefined();
  });

  it.each([
    ['+1707', 'TOO_SHORT'], // an area code alone (#1034)
    ['+1', 'TOO_SHORT'],
    ['+4420718', 'TOO_SHORT'],
    ['+170739752751', 'TOO_LONG'],
    ['+999123456789', 'INVALID_COUNTRY'], // no such country code
    ['707-397-5275', 'NOT_E164'], // not as the widget saves it
    ['+1 707 397 5275', 'NOT_E164'],
    ['+', 'NOT_E164'],
  ])('refuses %j (%s)', (phone, problem) => {
    expect(phoneNumberProblem(phone)).toBe(problem);
  });
});

describe("the form's phone-number rule", () => {
  // Phones as an event sets them up: Lark Camp's pattern, the widget in the
  // uiSchema, a camper's phone behind a $ref, and one shown only to drivers.
  const schema: RJSFSchema = {
    type: 'object',
    definitions: { phone: { type: 'string', title: 'Phone number', pattern: '^\\+[0-9]+$' } },
    properties: {
      phone: { $ref: '#/definitions/phone' },
      other: { type: 'string', title: 'Other number' },
      campers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            first_name: { type: 'string', title: 'First name' },
            phone: { $ref: '#/definitions/phone' },
          },
        },
      },
      driving: { type: 'boolean', title: 'Driving?' },
    },
    dependencies: {
      driving: {
        oneOf: [
          { properties: { driving: { const: false } } },
          {
            properties: {
              driving: { const: true },
              driver_phone: { $ref: '#/definitions/phone' },
            },
          },
        ],
      },
    },
  };
  const uiSchema: UiSchema = {
    phone: { 'ui:widget': 'PhoneInput' },
    campers: { items: { phone: { 'ui:widget': 'PhoneInput' } } },
    driver_phone: { 'ui:options': { widget: 'PhoneInput' } },
  };
  const validator = createMessagingValidator(() => ({ schema, uiSchema }));
  const errors = (formData: Record<string, unknown>) =>
    validator.validateFormData(formData, schema, undefined, undefined, uiSchema).errors;

  it('takes a whole number, and a field left empty', () => {
    expect(errors({ phone: '+17073975275', campers: [{ phone: '+442079460958' }, {}] })).toEqual([]);
    expect(errors({})).toEqual([]);
  });

  it('refuses a number cut short (#1034) with its own message', () => {
    const result = validator.validateFormData({ phone: '+1707' }, schema, undefined, undefined, uiSchema);
    expect(result.errors).toEqual([
      expect.objectContaining({
        name: 'format',
        property: '.phone',
        params: { format: 'phone', reason: 'TOO_SHORT' },
        message: 'Please enter the whole phone number',
        stack: 'Phone number: Please enter the whole phone number',
      }),
    ]);
    // Shown under the field, as ajv's errors are.
    expect(result.errorSchema).toEqual({ phone: { __errors: ['Please enter the whole phone number'] } });
  });

  it('refuses a number too long, or with no country, with a general message', () => {
    expect(errors({ phone: '+170739752751' })).toEqual([
      expect.objectContaining({ property: '.phone', message: 'Please check this phone number' }),
    ]);
    expect(errors({ phone: '+999123456789' })).toEqual([
      expect.objectContaining({ property: '.phone', message: 'Please check this phone number' }),
    ]);
  });

  it('asks for a saved number not in E.164 form to be entered again', () => {
    // (Beside the schema's own pattern, which refuses it too.)
    expect(errors({ phone: '(707) 397-5275' })).toContainEqual(
      expect.objectContaining({ property: '.phone', message: 'Please enter this phone number again' }),
    );
  });

  it("checks each camper's phone, and names the camper", () => {
    expect(
      errors({ campers: [{ phone: '+17073975275' }, { first_name: 'Ada', phone: '+1707' }] }),
    ).toEqual([
      expect.objectContaining({
        property: '.campers.1.phone',
        stack: '2nd camper (Ada) – Phone number: Please enter the whole phone number',
      }),
    ]);
  });

  it('checks only fields the phone widget answers', () => {
    expect(errors({ other: '+1707' })).toEqual([]);
  });

  it("checks a conditional phone only while the form shows it", () => {
    expect(errors({ driving: true, driver_phone: '+1707' })).toEqual([
      expect.objectContaining({ property: '.driver_phone', name: 'format' }),
    ]);
    // Answered, then hidden: the stale answer isn't the registrant's problem.
    expect(errors({ driving: false, driver_phone: '+1707' })).toEqual([]);
  });

  it("uses the event's own format message for the field", () => {
    const rules = { 'campers.*.phone': { format: '{{camper}}: enter the whole number' } };
    const withRules = createMessagingValidator(() => ({ schema, uiSchema, rules }));
    expect(
      withRules.validateFormData({ campers: [{ phone: '+1707' }] }, schema, undefined, undefined, uiSchema)
        .errors,
    ).toEqual([expect.objectContaining({ message: '1st camper: enter the whole number' })]);
  });

  it("uses the event's `*` default for format, as for any format error", () => {
    const rules = { '*': { format: 'Please check the format of {{field}}' } };
    const withRules = createMessagingValidator(() => ({ schema, uiSchema, rules }));
    expect(
      withRules.validateFormData({ phone: '+1707' }, schema, undefined, undefined, uiSchema).errors,
    ).toEqual([expect.objectContaining({ message: 'Please check the format of Phone number' })]);
  });

  it('is offered to the message editor as the field’s format error', () => {
    const fields = collectFieldPaths(schema, uiSchema);
    expect(fields.get('phone')?.keywords).toContain('format');
    expect(fields.get('phone')?.params.format).toEqual({ format: 'phone' });
    expect(fields.get('campers.*.phone')?.keywords).toContain('format');
    expect(fields.get('other')?.keywords).not.toContain('format');
    expect(builtInTemplate('format', { format: 'phone' })).toBe('Please check this phone number');
    expect(builtInTemplate('format')).toBe('Please enter a valid email address');
  });
});
