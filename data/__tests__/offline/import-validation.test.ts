/**
 * Offline validation of every event under data/ — no server needed.
 *
 * For each event: the module must load (a SyntaxError or an error thrown while
 * the module evaluates fails just that event), the exported object must satisfy
 * eventImportObjectSchema (validateEventImport, the same Ajv check
 * CamphoricEventCreator runs before importing) and every JSON Schema it carries must be well-formed. Its sample
 * registrations must satisfy the registration form's schema without any field
 * the schema doesn't declare. The event, as its overrides leave it, must pass
 * the server's form and pricing checks (server/camphoric/schema_checks.py,
 * run with python3): no default outside its choices, and no text or choice
 * answer the pricing reads that a registration may lack (#771).
 *
 * Runs under native ESM (jest.config.cjs: TypeScript compiled by @swc/jest,
 * with its imports left as ESM) because the event modules use import.meta.url
 * and ESM-only dependencies.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, test } from '@jest/globals';
import { Ajv } from 'ajv';
import { Ajv2019 } from 'ajv/dist/2019.js';

import {
  addFormats,
  validateEventImport,
  type EventData,
  type EventModule,
  type Fetch,
  type Lodgings,
  type SavedResults,
} from '../../eventImportObjectSchema.ts';

// Every directory that loadAllData.ts imports. Add new events here.
const EVENTS = ['harmony', 'lark', 'ltacampout', 'familyweek'];

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
const fakeResults = (): SavedResults => ({ event: { id: 1 }, lodging: fakeLodgingLookup() });

// The server's own checks, run on an event's fields (DR-106). They need the
// repository's server/ and python3. Outside CI they're skipped (saying why)
// where those are missing, as in the data container, which mounts only data/.
// In CI they always run, so a moved file or a missing python3 fails the job
// instead of quietly turning the check off.
const SCHEMA_CHECKS = fileURLToPath(
  new URL('../../../server/camphoric/schema_checks.py', import.meta.url),
);
const canRunSchemaChecks = process.env.CI === 'true' || (existsSync(SCHEMA_CHECKS)
  && spawnSync('python3', ['--version']).status === 0);

/**
 * The event as the importer leaves it: its data, then each override's PATCH
 * of the event applied (Harmony and LTA Campout set their pricing that way,
 * once the lodging exists).
 */
async function importedEvent({ data, overrides = [] }: EventModule) {
  const event = { ...data.event };
  const fetch: Fetch = async (method, url, body) => {
    if (method === 'PATCH' && /^\/api\/events\/[^/]+\/$/.test(url)) Object.assign(event, body);
    return {};
  };
  for (const override of overrides) await override(fetch, fakeResults(), () => undefined);
  return event;
}

describe.each(EVENTS)('data/%s', (name) => {
  let mod: { default: EventModule, eventName?: string };

  // One dynamic import per event (as loadAllData.ts does), so a broken event
  // fails only its own block.
  beforeAll(async () => {
    mod = await import(`../../${name}/index.ts`);
  });

  test('module loads and exports an event', () => {
    expect(mod.default?.data?.event?.name).toEqual(expect.any(String));
    if (mod.eventName !== undefined) {
      expect(mod.eventName).toBe(mod.default.data.event.name);
    }
  });

  test('conforms to eventImportObjectSchema (the check the importer runs)', () => {
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

  (canRunSchemaChecks ? test : test.skip)(
    canRunSchemaChecks
      ? "passes the server's form and pricing checks"
      : "passes the server's form and pricing checks (skipped: needs server/ and python3)",
    async () => {
      const event = await importedEvent(mod.default);
      const output = execFileSync('python3', [SCHEMA_CHECKS], { input: JSON.stringify(event) });
      expect(JSON.parse(output.toString())).toEqual({});
    },
  );

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
  const withMessages = (registration_error_messages: unknown) => ({
    organization: 'Test',
    event: { name: 'Test', registration_error_messages },
    reports: [],
    registration_types: [],
  });

  test('accepts a path → keyword → message table', () => {
    expect(validateEventImport(withMessages({
      'campers.*.phone': { pattern: '{{camper}}: enter a phone number' },
      '*': { required: '{{field}} is required' },
    }))).toEqual([]);
  });

  test.each([
    ['a list', ['nope']],
    ['a path mapped to a string', { 'campers.*.phone': 'nope' }],
    ['a non-string message', { 'campers.*.phone': { pattern: 42 } }],
    ['an empty message', { 'campers.*.phone': { pattern: '' } }],
    ['an empty path', { '': { required: 'x' } }],
    ['an empty keyword', { 'campers.*.phone': { '': 'x' } }],
  ])('rejects %s', (_label, value) => {
    expect(validateEventImport(withMessages(value))).not.toEqual([]);
  });
});

// Lark's Camp 2 cabin list is generated: the two-bed cabins take two campers
// and the numbers that don't exist are skipped.
describe('data/lark lodging', () => {
  let lodgings: Lodgings;

  beforeAll(async () => {
    const { default: lark }: { default: EventModule } = await import('../../lark/index.ts');
    lodgings = lark.data.lodgings!;
  });

  test.each(['03', '08', '11', '13', '19', '24', '26', '31'])('Camp 2 cabin %s has two beds', (n) => {
    expect(lodgings[`camp2_cabin_${n}`]?.capacity).toBe(2);
  });

  test('other Camp 2 cabins have four beds', () => {
    expect(lodgings.camp2_cabin_01?.capacity).toBe(4);
  });

  test.each(['32', '33'])('Camp 2 cabin %s is not created', (n) => {
    expect(lodgings[`camp2_cabin_${n}`]).toBeUndefined();
  });
});
