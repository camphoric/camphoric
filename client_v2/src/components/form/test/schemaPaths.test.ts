import type { RJSFSchema } from '@rjsf/utils';
import { describe, expect, it } from 'vitest';

import { collectFieldPaths } from '../schemaPaths';

const schema = {
  type: 'object',
  required: ['registrant_email'],
  definitions: {
    address: {
      type: 'object',
      properties: { street: { type: 'string', title: 'Street' } },
    },
    camper: {
      type: 'object',
      required: ['first_name'],
      properties: {
        first_name: { type: 'string', title: 'First name', maxLength: 50 },
        age: { type: 'integer', title: 'Age', minimum: 0 },
        attendance: {
          type: 'array',
          title: 'When will you attend?',
          minItems: 1,
          items: { type: 'string', enum: ['Fri', 'Sat'] },
        },
        driving: { type: 'string', title: 'Driving?', enum: ['Driver', 'Passenger'] },
        lodging: {
          type: 'object',
          title: 'Lodging',
          properties: {
            lodging_requested: {
              type: 'object',
              title: 'Lodging',
              required: ['id', 'choices'],
              properties: { id: { type: 'number' }, choices: { type: 'array' } },
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
                license_plate: { type: 'string', maxLength: 10 },
              },
              required: ['license_plate'],
            },
          ],
        },
      },
      if: { properties: { age: { maximum: 17 } } },
      then: { properties: { guardian: { type: 'string', title: 'Guardian' } }, required: ['guardian'] },
    },
  },
  properties: {
    registrant_email: { type: 'string', format: 'email', title: 'Registrant email' },
    address: { $ref: '#/definitions/address', title: 'Main address' },
    campers: { type: 'array', items: { $ref: '#/definitions/camper' } },
  },
} as RJSFSchema;

const uiSchema = { campers: { 'ui:title': 'Campers', items: { age: { 'ui:title': 'Age at camp' } } } };

describe('collectFieldPaths', () => {
  const fields = collectFieldPaths(schema, uiSchema);

  it('finds top-level, $ref and per-camper fields', () => {
    expect(fields.get('registrant_email')).toMatchObject({
      label: 'Registrant email',
      keywords: ['required', 'format'],
    });
    expect(fields.get('address.street')?.breadcrumb).toEqual(['Main address', 'Street']);
    expect(fields.get('campers.*.first_name')).toMatchObject({
      label: 'First name',
      breadcrumb: ['Campers', 'First name'],
      keywords: ['required', 'maxLength'],
      params: { maxLength: { limit: 50 } },
    });
  });

  it('uses ui:title over the schema title', () => {
    expect(fields.get('campers.*.age')?.label).toBe('Age at camp');
  });

  it('includes fields that only exist in dependency and if/then branches', () => {
    expect(fields.get('campers.*.license_plate')).toMatchObject({
      label: 'License plate',
      keywords: ['required', 'maxLength'],
    });
    expect(fields.get('campers.*.guardian')).toMatchObject({ label: 'Guardian', keywords: ['required'] });
  });

  it('labels untitled technical keys after their parent', () => {
    expect(fields.get('campers.*.lodging.lodging_requested.id')).toMatchObject({
      label: 'Lodging',
      keywords: ['required', 'type'],
    });
  });

  it('lists array items (checkbox choices) under the array', () => {
    expect(fields.get('campers.*.attendance')?.keywords).toEqual(['minItems']);
    expect(fields.get('campers.*.attendance.*')).toMatchObject({
      label: 'When will you attend?',
      keywords: ['enum'],
    });
  });

  it('keeps the driving field once, with its enum', () => {
    expect(fields.get('campers.*.driving')).toMatchObject({ label: 'Driving?', keywords: ['enum'] });
  });

  it('survives recursive schemas', () => {
    const recursive = {
      definitions: { node: { type: 'object', properties: { child: { $ref: '#/definitions/node' } } } },
      $ref: '#/definitions/node',
    } as RJSFSchema;
    expect(() => collectFieldPaths(recursive)).not.toThrow();
  });
});
