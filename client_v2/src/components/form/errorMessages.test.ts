import type { RJSFSchema, RJSFValidationError } from '@rjsf/utils';
import type { RegistrationErrorMessages } from 'api-types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  normalizeErrorPath,
  removeRule,
  resolveErrorMessages,
  rulesToList,
  setRule,
  validateRules,
} from './errorMessages';
import { createMessagingValidator } from './messagingValidator';

// A cut-down Camp Harmony registration: campers with a phone pattern, a
// driver-only licence plate (a `dependencies` oneOf branch), and the
// server-built lodging object whose `id` is only set for a final choice.
const schema = {
  type: 'object',
  required: ['registrant_email'],
  properties: {
    registrant_email: { type: 'string', format: 'email', title: 'Registrant email' },
    campers: {
      type: 'array',
      items: {
        type: 'object',
        required: ['first_name'],
        properties: {
          first_name: { type: 'string', title: 'First name' },
          last_name: { type: 'string', title: 'Last name' },
          phone: { type: 'string', title: 'Phone Number', pattern: '^\\+[0-9]+$' },
          driving: { type: 'string', title: 'Driving?', enum: ['Driver', 'Passenger'] },
          lodging: {
            type: 'object',
            title: 'Lodging',
            properties: {
              lodging_requested: {
                type: 'object',
                title: 'Lodging',
                required: ['id', 'choices'],
                properties: {
                  id: { type: 'number' },
                  choices: { type: 'array', minItems: 1, items: { type: 'number' } },
                },
              },
            },
          },
        },
        dependencies: {
          driving: {
            oneOf: [
              { properties: { driving: { enum: ['Passenger'] } } },
              {
                properties: {
                  driving: { enum: ['Driver'] },
                  license_plate: { type: 'string', title: 'License plate' },
                },
                required: ['license_plate'],
              },
            ],
          },
        },
      },
    },
  },
} as RJSFSchema;

const validFormData = {
  registrant_email: 'pat@example.com',
  campers: [
    { first_name: 'Margaret', last_name: 'Miles', driving: 'Passenger' },
    { first_name: 'Child', last_name: 'Miles', driving: 'Passenger' },
  ],
};

/** Validate through the real ajv validator with the given rules. */
function validate(formData: unknown, rules?: RegistrationErrorMessages, pathPrefix?: string) {
  const validator = createMessagingValidator(() => ({ rules, schema, pathPrefix }));
  return validator.validateFormData(formData, schema).errors;
}

interface TraceDetail {
  context: Record<string, unknown>;
  errors: Record<string, unknown>[];
}

const visible = (errors: RJSFValidationError[]) =>
  errors.filter((error) => error.stack).map((error) => error.stack);

describe('normalizeErrorPath', () => {
  it('strips the leading dot and turns array indexes into *', () => {
    expect(normalizeErrorPath('.campers.1.lodging.lodging_requested.id')).toBe(
      'campers.*.lodging.lodging_requested.id',
    );
  });

  it('handles root-level required errors, which have no leading dot', () => {
    expect(normalizeErrorPath('registrant_email')).toBe('registrant_email');
    expect(normalizeErrorPath('')).toBe('');
  });

  it('prepends a prefix for forms that render part of the registration', () => {
    expect(normalizeErrorPath('.phone', 'campers.*')).toBe('campers.*.phone');
    expect(normalizeErrorPath('', 'campers.*')).toBe('campers.*');
  });
});

describe('resolveErrorMessages', () => {
  const unfinishedRv = {
    ...validFormData,
    campers: [
      validFormData.campers[0],
      { ...validFormData.campers[1], lodging: { lodging_requested: { choices: [2] } } },
    ],
  };

  it('uses the built-in message, with context in the list, when the event has no rule', () => {
    const errors = validate(unfinishedRv);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('This field is required');
    expect(errors[0].stack).toBe('2nd camper (Child Miles) – Lodging: This field is required');
    // Placement and focus rely on these staying as rjsf produced them.
    expect(errors[0].property).toBe('.campers.1.lodging.lodging_requested.id');
    expect(errors[0].name).toBe('required');
  });

  it("prefers the field's own rule, then the event's * default, then the built-in", () => {
    const rules: RegistrationErrorMessages = {
      'campers.*.lodging.lodging_requested.id': {
        required: '{{camper}}: please finish choosing your lodging',
      },
      '*': { required: '{{field}} is missing', pattern: 'Custom pattern default' },
    };
    const [lodging] = validate(unfinishedRv, rules);
    expect(lodging.message).toBe('2nd camper (Child Miles): please finish choosing your lodging');
    // The template names the camper, so the list shows the message as-is.
    expect(lodging.stack).toBe(lodging.message);

    const [missingEmail] = validate({ ...validFormData, registrant_email: undefined }, rules);
    expect(missingEmail.message).toBe('Registrant email is missing');

    const [badEmail] = validate({ ...validFormData, registrant_email: 'nope' }, rules);
    expect(badEmail.message).toBe('Please enter a valid email address');
  });

  it('renders placeholders, including ajv params', () => {
    const rules = {
      'campers.*.phone': { pattern: 'Camper {{camperNumber}} ({{field}}) must match {{params.pattern}}' },
    };
    const [error] = validate(
      { ...validFormData, campers: [{ ...validFormData.campers[0], phone: '555' }] },
      rules,
    );
    expect(error.message).toBe('Camper 1 (Phone Number) must match ^\\+[0-9]+$');
  });

  it('keeps & and quotes unescaped (the text is rendered as React text)', () => {
    const [error] = validate(unfinishedRv, {
      'campers.*.lodging.lodging_requested.id': { required: 'Lodging & "RV length"' },
    });
    expect(error.message).toBe('Lodging & "RV length"');
  });

  it('blanks the oneOf / branch-discriminator noise next to the real error, without dropping any', () => {
    const errors = validate({
      ...validFormData,
      campers: [{ ...validFormData.campers[0], driving: 'Driver' }],
    });
    // ajv reports the missing plate plus the failed branch discriminator and
    // the oneOf summary; only the plate is shown, but all still block submit.
    expect(errors.length).toBeGreaterThan(1);
    expect(visible(errors)).toEqual([
      '1st camper (Margaret Miles) – License plate: This field is required',
    ]);
    expect(errors.filter((error) => !error.message).map((error) => error.name).sort()).toEqual(
      expect.arrayContaining(['oneOf']),
    );
  });

  it('matches array-form dependencies errors as required', () => {
    const [error] = resolveErrorMessages(
      [
        {
          name: 'dependencies',
          property: '.campers.0.address',
          message: "must have property 'address' when property 'different' is present",
          params: { missingProperty: 'address' },
          stack: '',
          schemaPath: '#/dependencies',
        },
      ],
      { rules: { 'campers.*.address': { required: 'Please give the address' } } },
    );
    expect(error.message).toBe('Please give the address');
  });

  it('blanks exact duplicates on the same field', () => {
    const error: RJSFValidationError = {
      name: 'required',
      property: 'registrant_email',
      message: 'raw',
      stack: 'raw',
      params: { missingProperty: 'registrant_email' },
    };
    const resolved = resolveErrorMessages([error, { ...error }]);
    expect(resolved).toHaveLength(2);
    expect(resolved.map((e) => e.message)).toEqual(['This field is required', '']);
  });

  it('falls back to the built-in message when an event template fails to render', () => {
    const [error] = validate(unfinishedRv, {
      'campers.*.lodging.lodging_requested.id': { required: '{{#if}}broken' },
    });
    expect(error.message).toBe('This field is required');
  });

  it('uses the edited camper and the path prefix in the admin camper form', () => {
    const camperSchema = (schema.properties!.campers as { items: RJSFSchema }).items;
    const validator = createMessagingValidator(() => ({
      rules: { 'campers.*.phone': { pattern: '{{camper}}: enter a phone number like +15555555555' } },
      pathPrefix: 'campers.*',
      camper: { label: 'Child Miles' },
      schema: camperSchema,
    }));
    const [error] = validator.validateFormData(
      { first_name: 'Child', phone: '555' },
      camperSchema,
    ).errors;
    expect(error.message).toBe('Camper (Child Miles): enter a phone number like +15555555555');
  });

  describe('debug tracing', () => {
    afterEach(() => {
      window.localStorage.removeItem('DEBUG');
      vi.restoreAllMocks();
    });

    it('logs nothing unless DEBUG is set', () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      validate(unfinishedRv);
      expect(log).not.toHaveBeenCalled();
    });

    it('logs the raw error, the context and the matched key', () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      window.localStorage.setItem('DEBUG', '1');
      const rules = { 'campers.*.lodging.lodging_requested.id': { required: 'Finish your lodging' } };
      validate(unfinishedRv, rules);

      expect(log).toHaveBeenCalledTimes(1);
      const [label, detail] = log.mock.calls[0] as [string, TraceDetail];
      expect(label).toBe('validation: 1 error');
      expect(detail.context).toMatchObject({ rules: 1, formData: unfinishedRv });
      expect(detail.errors[0]).toMatchObject({
        raw: { name: 'required', property: '.campers.1.lodging.lodging_requested.id' },
        lookupPath: 'campers.*.lodging.lodging_requested.id',
        outcome: 'matched',
        matched: {
          key: 'campers.*.lodging.lodging_requested.id',
          keyword: 'required',
          source: 'event rule',
        },
        message: 'Finish your lodging',
      });
    });

    it('logs when nothing matched', () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      window.localStorage.setItem('DEBUG', '1');
      resolveErrorMessages([
        { name: 'multipleOf', property: '.count', message: 'must be multiple of 5', stack: '', params: {} },
      ]);
      const detail = log.mock.calls[0][1] as TraceDetail;
      expect(detail.errors[0]).toMatchObject({
        outcome: 'no match — fallback',
        message: 'must be multiple of 5',
      });
    });
  });
});

describe('rule map helpers', () => {
  const rules: RegistrationErrorMessages = {
    'campers.*.phone': { pattern: 'Phone!' },
    '*': { required: 'Required!' },
  };

  it('lists rules with the * defaults first', () => {
    expect(rulesToList(rules)).toEqual([
      { path: '*', keyword: 'required', message: 'Required!' },
      { path: 'campers.*.phone', keyword: 'pattern', message: 'Phone!' },
    ]);
  });

  it('sets, moves and removes rules without mutating', () => {
    const moved = setRule(
      rules,
      { path: 'campers.*.email', keyword: 'format', message: 'Email!' },
      { path: 'campers.*.phone', keyword: 'pattern' },
    );
    expect(moved).toEqual({ '*': { required: 'Required!' }, 'campers.*.email': { format: 'Email!' } });
    expect(rules['campers.*.phone']).toEqual({ pattern: 'Phone!' });
    expect(removeRule(moved, { path: '*', keyword: 'required' })).toEqual({
      'campers.*.email': { format: 'Email!' },
    });
  });
});

describe('validateRules', () => {
  it('accepts a good map', () => {
    expect(validateRules({ '*': { required: '{{field}} is required' } })).toEqual({
      errors: [],
      warnings: [],
    });
  });

  it('rejects bad shapes, empty messages and broken templates', () => {
    expect(validateRules(['nope']).errors).toHaveLength(1);
    const { errors } = validateRules({
      a: 'nope',
      b: { required: '' },
      c: { required: '{{#if}}broken' },
      d: { required: '{{unknownHelper field}}' },
    });
    expect(errors).toHaveLength(4);
  });

  it('only warns about paths the form does not have', () => {
    const problems = validateRules(
      { 'campers.*.nickname': { required: 'x' }, '*': { required: 'y' } },
      new Set(['campers.*.phone']),
    );
    expect(problems.errors).toEqual([]);
    expect(problems.warnings).toEqual([`"campers.*.nickname" isn't a field on the registration form`]);
  });
});
