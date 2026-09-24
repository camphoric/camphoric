/**
 * Offline validation of every event under data/ — no server needed.
 *
 * For each event: the module must load (a SyntaxError or an error thrown while
 * the module evaluates fails just that event), the exported object must satisfy
 * eventImportObjectSchema (the same Ajv check CamphoricEventCreator runs before
 * importing) and every JSON Schema it carries must be well-formed.
 *
 * Runs under native ESM (jest.config.cjs: transform: {}) because the event
 * modules use import.meta.url and ESM-only dependencies.
 */

import { beforeAll, describe, expect, test } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import eventImportObjectSchema from '../../eventImportObjectSchema.js';

// Every directory that loadAllData.js imports. Add new events here.
const EVENTS = ['harmony', 'lark', 'ltacampout', 'familyweek'];

// Event fields that hold a JSON Schema. (registration_ui_schema is an rjsf
// uiSchema, not a JSON Schema, and registration_deposit_schema is template data.)
const JSON_SCHEMA_FIELDS = [
  'camper_schema',
  'registration_schema',
  'payment_schema',
  'deposit_schema',
];

// Event fields that hold a map of { key: { data: <JSON Schema>, ui: <uiSchema> } }.
const ADMIN_SCHEMA_FIELDS = ['camper_admin_schema', 'registration_admin_schema'];

const importAjv = () => {
  const ajv = new Ajv({ allowUnionTypes: true });
  addFormats(ajv);
  return ajv;
};

// strict: false mirrors Django's Draft7Validator.check_schema (rjsf keywords such
// as enumNames are allowed); only the schema's structure is checked, not formats.
const schemaAjv = () => new Ajv({ strict: false, allowUnionTypes: true, validateFormats: false });

describe.each(EVENTS)('data/%s', (name) => {
  let mod;

  // One dynamic import per event, so a broken event fails only its own block —
  // unlike loadAllData.js, whose static imports let one bad file sink all four.
  beforeAll(async () => {
    mod = await import(`../../${name}/index.js`);
  });

  test('module loads and exports an event', () => {
    expect(mod.default?.data?.event?.name).toEqual(expect.any(String));
    if (mod.eventName !== undefined) {
      expect(mod.eventName).toBe(mod.default.data.event.name);
    }
  });

  test('conforms to eventImportObjectSchema (the check the importer runs)', () => {
    const ajv = importAjv();
    const valid = ajv.validate(eventImportObjectSchema, mod.default.data);
    expect(ajv.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });

  test.each(JSON_SCHEMA_FIELDS)('%s is a well-formed JSON Schema', (field) => {
    const { event } = mod.default.data;
    const schema = event[field];
    if (schema === undefined) return; // optional for this event
    const ajv = schemaAjv();
    expect(ajv.validateSchema(schema)).toBe(true);
    expect(ajv.errors ?? []).toEqual([]);
    // The camper schema may $ref the registration schema's definitions (the app
    // injects them before use), so compile it the same way. This still catches
    // genuinely bad $refs, enums, etc.
    const compilable = field === 'camper_schema'
      ? {
        ...schema,
        definitions: {
          ...(event.registration_schema?.definitions ?? {}),
          ...(schema.definitions ?? {}),
        },
      }
      : schema;
    expect(() => ajv.compile(compilable)).not.toThrow();
  });

  test.each(ADMIN_SCHEMA_FIELDS)('%s holds well-formed data schemas', (field) => {
    const map = mod.default.data.event[field];
    if (map === undefined) return;
    for (const [key, entry] of Object.entries(map)) {
      const ajv = schemaAjv();
      expect({ key, valid: ajv.validateSchema(entry.data) }).toEqual({ key, valid: true });
    }
  });

  test('overrides and sampleRegGenerator are functions', () => {
    const { overrides = [], sampleRegGenerator } = mod.default;
    overrides.forEach((fn) => expect(typeof fn).toBe('function'));
    if (sampleRegGenerator) expect(typeof sampleRegGenerator).toBe('function');
  });
});

// registration_error_messages is optional, but when present it must be
// { path: { keyword: message } } with non-empty strings — a malformed table
// fails the import before any request is made.
describe('eventImportObjectSchema: registration_error_messages', () => {
  const withMessages = (registration_error_messages) => ({
    organization: 'Test',
    event: { name: 'Test', registration_error_messages },
    reports: [],
    registration_types: [],
  });

  test('accepts a path → keyword → message table', () => {
    const ajv = importAjv();
    ajv.validate(eventImportObjectSchema, withMessages({
      'campers.*.phone': { pattern: '{{camper}}: enter a phone number' },
      '*': { required: '{{field}} is required' },
    }));
    expect(ajv.errors ?? []).toEqual([]);
  });

  test.each([
    ['a list', ['nope']],
    ['a path mapped to a string', { 'campers.*.phone': 'nope' }],
    ['a non-string message', { 'campers.*.phone': { pattern: 42 } }],
    ['an empty message', { 'campers.*.phone': { pattern: '' } }],
    ['an empty path', { '': { required: 'x' } }],
    ['an empty keyword', { 'campers.*.phone': { '': 'x' } }],
  ])('rejects %s', (_label, value) => {
    const ajv = importAjv();
    expect(ajv.validate(eventImportObjectSchema, withMessages(value))).toBe(false);
  });
});
