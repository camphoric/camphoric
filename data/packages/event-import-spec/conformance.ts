/**
 * The checks every event module must pass, with no server: the module loads
 * and exports an event, its import object passes validateEventImport (the
 * check the importer runs before any request), every JSON Schema it carries is
 * well-formed, its sample registrations fit the registration form's schema
 * without any field the schema doesn't declare, and it declares the
 * organization it names.
 *
 * An event package runs them from its own tests, inside a describe:
 *
 *     describe('@camphoric/camphoric-event-lark', () => {
 *       describeEventModule(() => import('../index.ts'));
 *     });
 *
 * They need Jest running native ESM (the event modules use import.meta.url).
 */

import { beforeAll, expect, test } from '@jest/globals';
import { Ajv } from 'ajv';
import { Ajv2019 } from 'ajv/dist/2019.js';

import {
  addFormats,
  validateEventImport,
  type EventData,
  type EventModule,
  type Fetch,
  type LoadedEventModule,
  type Lodgings,
  type SavedResults,
} from './index.ts';

// Event fields that hold a JSON Schema. (registration_ui_schema is an rjsf
// uiSchema, not a JSON Schema, and registration_deposit_schema is template data.)
const JSON_SCHEMA_FIELDS: (keyof EventData)[] = [
  'camper_schema',
  'registration_schema',
  'payment_schema',
  'deposit_schema',
];

// Event fields that hold a map of { key: { data: <JSON Schema>, ui: <uiSchema> } }.
const ADMIN_SCHEMA_FIELDS: (keyof EventData)[] = ['camper_admin_schema', 'registration_admin_schema'];

// The parts of an object's JSON Schema that the form schema builds on
interface ObjectSchema {
  definitions?: Record<string, unknown>;
  properties?: Record<string, unknown>;
  required?: string[];
  [keyword: string]: unknown;
}

// strict: false mirrors Django's Draft7Validator.check_schema (rjsf keywords such
// as enumNames are allowed); only the schema's structure is checked, not formats.
const schemaAjv = () => new Ajv({ strict: false, allowUnionTypes: true, validateFormats: false });

// Applicators whose subschemas describe the same object as their parent, so the
// parent's unevaluatedProperties already sees the properties they declare.
const BRANCH_KEYWORDS = ['oneOf', 'anyOf', 'allOf', 'not', 'if', 'then', 'else', 'dependencies'];

/**
 * A copy of `schema` in which every object that declares properties rejects
 * any other. unevaluatedProperties (not additionalProperties) so that fields
 * declared only in a dependencies/oneOf branch, such as Lark's meals, count as
 * declared.
 */
function disallowUndeclared(schema: unknown, isBranch = false): unknown {
  if (Array.isArray(schema)) return schema.map((s): unknown => disallowUndeclared(s, isBranch));
  if (!schema || typeof schema !== 'object') return schema;
  const out: ObjectSchema = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'enum' || key === 'const' || key === 'default' || key === 'examples') {
      out[key] = value;
    } else if (key === 'properties' || key === 'definitions' || key === 'dependencies') {
      out[key] = Object.fromEntries(Object.entries(value as object).map(([k, v]) => [
        k,
        // A dependencies entry is a branch of this object (or a list of required names).
        disallowUndeclared(v, key === 'dependencies'),
      ]));
    } else {
      out[key] = disallowUndeclared(value, BRANCH_KEYWORDS.includes(key));
    }
  }
  if (out.properties && !isBranch) out.unevaluatedProperties = false;
  return out;
}

/**
 * The registration form's schema as the server builds it (get_form_schema in
 * server/camphoric/views.py): the camper schema as a definition, the campers
 * list and registrant_email added. The server supplies the lodging field, so
 * any value passes here.
 */
function formSchema(event: EventData) {
  const registration_schema: ObjectSchema = event.registration_schema ?? {};
  const camper_schema: ObjectSchema = event.camper_schema ?? {};

  return {
    ...registration_schema,
    definitions: {
      ...(registration_schema.definitions ?? {}),
      camper: {
        ...camper_schema,
        properties: { ...(camper_schema.properties ?? {}), lodging: {} },
      },
    },
    required: [...(registration_schema.required ?? []), 'registrant_email'],
    properties: {
      registrant_email: { type: 'string', format: 'email' },
      ...(registration_schema.properties ?? {}),
      campers: { type: 'array', minItems: 1, items: { $ref: '#/definitions/camper' } },
    },
  };
}

// Stands in for the importer's lodging lookup (key → saved lodging).
const fakeLodgingLookup = () => new Proxy({}, { get: () => ({ id: 1 }) }) as Lodgings;

// What the importer has saved, as overrides and sample registrations see it
export const fakeResults = (): SavedResults => ({ event: { id: 1 }, lodging: fakeLodgingLookup() });

/**
 * The event as the importer leaves it: its data, then each override's PATCH
 * of the event applied (Harmony and LTA Campout set their pricing that way,
 * once the lodging exists).
 */
export async function importedEvent({ data, overrides = [] }: EventModule) {
  const event = { ...data.event };
  const fetch: Fetch = async (method, url, body) => {
    if (method === 'PATCH' && /^\/api\/events\/[^/]+\/$/.test(url)) Object.assign(event, body);
    return {};
  };
  for (const override of overrides) await override(fetch, fakeResults(), () => undefined);
  return event;
}

/**
 * Register the conformance tests for the event module `load` imports. Each
 * event loads on its own, so a broken one fails only its own tests.
 */
export function describeEventModule(load: () => Promise<LoadedEventModule>) {
  let mod: LoadedEventModule;

  beforeAll(async () => {
    mod = await load();
  });

  test('module loads and exports an event', () => {
    expect(mod.default?.data?.event?.name).toEqual(expect.any(String));
    if (mod.eventName !== undefined) {
      expect(mod.eventName).toBe(mod.default.data.event.name);
    }
  });

  test('conforms to the event import schema (the check the importer runs)', () => {
    expect(validateEventImport(mod.default.data)).toEqual([]);
  });

  test.each(JSON_SCHEMA_FIELDS)('%s is a well-formed JSON Schema', (field) => {
    const { event } = mod.default.data;
    const schema = event[field] as ObjectSchema | undefined;
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
    const map = mod.default.data.event[field] as Record<string, { data: object }> | undefined;
    if (map === undefined) return;
    for (const [key, entry] of Object.entries(map)) {
      const ajv = schemaAjv();
      expect({ key, valid: ajv.validateSchema(entry.data) }).toEqual({ key, valid: true });
    }
  });

  // The server validates registrations against the schema but allows fields it
  // doesn't declare, so a sample registration can drift from its event (as
  // Lark's vaccination_status did) without the import failing.
  test('sample registrations fit the form schema, with no undeclared fields', async () => {
    const { data, sampleRegGenerator } = mod.default;
    if (!sampleRegGenerator) return;
    const noFetch: Fetch = async () => {
      throw new Error('sample registrations are made without the server');
    };
    const regs = await sampleRegGenerator(noFetch, fakeResults(), () => undefined);
    const ajv = new Ajv2019({ strict: false, allowUnionTypes: true, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(disallowUndeclared(formSchema(data.event)) as object);
    regs.forEach(({ formData }, index) => {
      validate(formData);
      expect({ index, errors: validate.errors ?? [] }).toEqual({ index, errors: [] });
    });
  });

  test('overrides and sampleRegGenerator are functions', () => {
    const { overrides = [], sampleRegGenerator } = mod.default;
    overrides.forEach((fn) => expect(typeof fn).toBe('function'));
    if (sampleRegGenerator) expect(typeof sampleRegGenerator).toBe('function');
  });

  test('declares the organization its data names', () => {
    expect(mod.default.organization?.organization?.name).toBe(mod.default.data.organization);
  });
}
