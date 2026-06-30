import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { describe, expect, it } from 'vitest';

import { combineAdminSchema, deriveAdminUiSchema, injectDefinitions } from './adminSchema';

describe('deriveAdminUiSchema', () => {
  it('strips enumDisabled everywhere so admins can pick disabled options', () => {
    const uiSchema: UiSchema = {
      role: {
        'ui:widget': 'select',
        'ui:enumDisabled': ['admin'],
        'ui:options': { enumDisabled: ['guest'] },
      },
      group: {
        member: { 'ui:widget': 'radio', enumDisabled: ['x'] },
      },
    };

    const admin = deriveAdminUiSchema(uiSchema) as {
      role: { 'ui:widget': string };
      group: { member: { 'ui:widget': string } };
    };

    expect(JSON.stringify(admin)).not.toContain('enumDisabled');
    // Non-stripped UI options are preserved.
    expect(admin.role['ui:widget']).toBe('select');
    expect(admin.group.member['ui:widget']).toBe('radio');
  });
});

describe('injectDefinitions', () => {
  it('adds shared definitions, with the schema’s own winning on conflict', () => {
    const schema: RJSFSchema = {
      type: 'object',
      definitions: { color: { type: 'string', enum: ['red'] } },
    };
    const shared: RJSFSchema['definitions'] = {
      color: { type: 'string', enum: ['blue'] },
      size: { type: 'number' },
    };

    const merged = injectDefinitions(schema, shared);

    expect(merged.definitions?.size).toEqual({ type: 'number' });
    expect(merged.definitions?.color).toEqual({ type: 'string', enum: ['red'] });
  });

  it('returns the schema unchanged when there are no definitions', () => {
    const schema: RJSFSchema = { type: 'object' };
    expect(injectDefinitions(schema, undefined)).toBe(schema);
  });
});

describe('combineAdminSchema', () => {
  it('combines the {key:{data,ui}} map and orders fields by title', () => {
    const map = {
      notes: { data: { type: 'string', title: 'Zebra notes' }, ui: { 'ui:widget': 'textarea' } },
      flag: { data: { type: 'boolean', title: 'Alpha flag' } },
    };

    const { schema, uiSchema } = combineAdminSchema(map);

    expect(schema).toEqual({
      type: 'object',
      properties: {
        notes: { type: 'string', title: 'Zebra notes' },
        flag: { type: 'boolean', title: 'Alpha flag' },
      },
    });
    expect(uiSchema.notes).toEqual({ 'ui:widget': 'textarea' });
    // Ordered by data.title: "Alpha flag" before "Zebra notes".
    expect(uiSchema['ui:order']).toEqual(['flag', 'notes']);
  });

  it('produces an empty object schema for an empty map', () => {
    const { schema, uiSchema } = combineAdminSchema({});
    expect(schema).toEqual({ type: 'object', properties: {} });
    expect(uiSchema['ui:order']).toEqual([]);
  });
});
