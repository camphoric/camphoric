/**
 * Enumerate every field a JSON Schema form can have (SPEC §7.1, §8.8, DR-34):
 * each field's path (in the same shape as validation-message keys, array
 * indexes written as `*`), a human-readable label, and the validation keywords
 * that can fail on it. Unlike rjsf's `retrieveSchema`, which resolves only the
 * branches the current data activates, this walks every branch — `$ref`,
 * `properties`, array `items`, `dependencies` (array and schema form, including
 * each `oneOf`/`anyOf` branch), `allOf`, and `if`/`then`/`else` — so
 * conditional fields (a licence plate shown only to drivers) are included.
 *
 * Used to label fields in validation messages (`{{field}}`) and to offer
 * fields and error types in the admin validation-message editor.
 */

import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';

/** Validation keywords an admin can write a message for. */
export const ERROR_KEYWORDS = [
  'required',
  'pattern',
  'format',
  'enum',
  'const',
  'type',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'uniqueItems',
] as const;

export type ErrorKeyword = (typeof ERROR_KEYWORDS)[number];

export interface FieldPathInfo {
  /** Dotted path, array indexes as `*`, e.g. `campers.*.lodging.lodging_requested.id`. */
  path: string;
  /** Titles from the root to this field (the field's own label last). */
  breadcrumb: string[];
  /** The field's label: its title, else the nearest titled ancestor's, else its key. */
  label: string;
  /** Keywords that can fail on this field, `required` first. */
  keywords: ErrorKeyword[];
  /** Representative ajv params per keyword (limits, pattern, …), for previews. */
  params: Partial<Record<ErrorKeyword, Record<string, unknown>>>;
}

type Schema = JSONSchema7;

const isSchema = (value: unknown): value is Schema =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** "license_plate" → "License plate". */
export function humanizeKey(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

function resolveRef(ref: string, root: Schema): Schema | undefined {
  if (!ref.startsWith('#/')) return undefined;
  let node: unknown = root;
  for (const raw of ref.slice(2).split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!isRecord(node)) return undefined;
    node = node[key];
  }
  return isSchema(node) ? node : undefined;
}

/** Follow `$ref`s (with a cycle guard), keeping any sibling keys (e.g. a title). */
function deref(definition: JSONSchema7Definition | undefined, root: Schema, seen: Set<string>) {
  if (!isSchema(definition)) return undefined;
  let schema = definition;
  while (typeof schema.$ref === 'string') {
    const ref = schema.$ref;
    if (seen.has(ref)) return undefined;
    seen.add(ref);
    const target = resolveRef(ref, root);
    if (!target) return undefined;
    const { $ref: _ignored, ...siblings } = schema;
    schema = { ...target, ...siblings };
  }
  return schema;
}

function uiChild(uiSchema: unknown, key: string): UiSchema | undefined {
  if (!isRecord(uiSchema)) return undefined;
  const child = uiSchema[key === '*' ? 'items' : key];
  return isRecord(child) ? (child as UiSchema) : undefined;
}

function uiTitle(uiSchema: UiSchema | undefined): string | undefined {
  if (!uiSchema) return undefined;
  const direct = uiSchema['ui:title'];
  if (typeof direct === 'string' && direct) return direct;
  const options = uiSchema['ui:options'];
  const fromOptions = isRecord(options) ? options.title : undefined;
  return typeof fromOptions === 'string' && fromOptions ? fromOptions : undefined;
}

/** The keywords (and representative params) a schema can fail with. */
function keywordsOf(schema: Schema) {
  const keywords: ErrorKeyword[] = [];
  const params: FieldPathInfo['params'] = {};
  const add = (keyword: ErrorKeyword, p?: Record<string, unknown>) => {
    keywords.push(keyword);
    if (p) params[keyword] = p;
  };
  if (typeof schema.pattern === 'string') add('pattern', { pattern: schema.pattern });
  if (typeof schema.format === 'string') add('format', { format: schema.format });
  const alternatives = [...(schema.oneOf ?? []), ...(schema.anyOf ?? [])];
  if (Array.isArray(schema.enum)) {
    add('enum', { allowedValues: schema.enum });
  } else if (alternatives.some((alt) => isSchema(alt) && alt.const !== undefined)) {
    add('enum', {});
  }
  if (schema.const !== undefined) add('const', { allowedValue: schema.const });
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.includes('number') || types.includes('integer')) {
    add('type', { type: types.includes('integer') ? 'integer' : 'number' });
  }
  const limits = [
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'minLength',
    'maxLength',
    'minItems',
    'maxItems',
  ] as const;
  for (const keyword of limits) {
    const limit = schema[keyword];
    if (typeof limit === 'number') add(keyword, { limit });
  }
  if (typeof schema.multipleOf === 'number') add('multipleOf', { multipleOf: schema.multipleOf });
  if (schema.uniqueItems === true) add('uniqueItems', {});
  return { keywords, params };
}

const MAX_DEPTH = 12;

/**
 * An untitled field's label: array items read as their array ("Campers"), and
 * short technical keys (`id`) as their parent ("Lodging"); otherwise the
 * humanised key ("License plate").
 */
function fallbackLabel(key: string, parentLabel: string | undefined) {
  if ((key === '*' || key.length <= 3) && parentLabel) return parentLabel;
  return humanizeKey(key);
}

class FieldCollector {
  readonly fields = new Map<string, FieldPathInfo>();
  /** Paths whose label came from a real title (not a fallback). */
  private readonly titled = new Set<string>();

  constructor(private readonly root: Schema) {}

  /**
   * Record (or merge into) a field. A field defined in several places — e.g.
   * once in `properties` and again in a dependency branch — keeps its first
   * real title and the union of its keywords.
   */
  private record(
    path: string[],
    breadcrumb: string[],
    title: string | undefined,
    schema: Schema | undefined,
    required: boolean,
    parentLabel: string | undefined,
  ) {
    const key = path.join('.');
    const existing = this.fields.get(key);
    const { keywords, params } = schema ? keywordsOf(schema) : { keywords: [], params: {} };
    const merged = new Set<ErrorKeyword>([...(existing?.keywords ?? []), ...keywords]);
    if (required) merged.add('required');

    const fallback = fallbackLabel(path[path.length - 1] ?? '', parentLabel);
    let label = existing?.label ?? title ?? fallback;
    let trail = existing?.breadcrumb ?? breadcrumb;
    if (title && !this.titled.has(key)) {
      label = title;
      trail = breadcrumb;
      this.titled.add(key);
    }

    this.fields.set(key, {
      path: key,
      breadcrumb: trail,
      label,
      keywords: ERROR_KEYWORDS.filter((keyword) => merged.has(keyword)),
      params: { ...params, ...(existing?.params ?? {}) },
    });
  }

  /** Record a field and walk into it. */
  visit(
    definition: JSONSchema7Definition | undefined,
    path: string[],
    breadcrumb: string[],
    uiSchema: UiSchema | undefined,
    required: boolean,
  ) {
    // Recursive schemas (a $ref back to an ancestor) stop at a sane depth.
    if (path.length > MAX_DEPTH) return;
    const schema = deref(definition, this.root, new Set());
    const key = path[path.length - 1] ?? '';
    const parentLabel = breadcrumb[breadcrumb.length - 1];
    if (key === '*') {
      // Array items share their array's label and crumbs.
      this.record(path, breadcrumb, undefined, schema, required, parentLabel);
      if (schema) this.walk(schema, path, breadcrumb, uiSchema);
      return;
    }
    const title = uiTitle(uiSchema) ?? (schema?.title || undefined);
    const trail = [...breadcrumb, title ?? humanizeKey(key)];
    this.record(path, trail, title, schema, required, parentLabel);
    if (schema) this.walk(schema, path, trail, uiSchema);
  }

  /** Walk a schema's children, and every conditional branch, at the same path. */
  walk(schema: Schema, path: string[], breadcrumb: string[], uiSchema: UiSchema | undefined) {
    const required = new Set(schema.required ?? []);
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      this.visit(child, [...path, key], breadcrumb, uiChild(uiSchema, key), required.has(key));
    }
    // Required keys a branch lists without declaring the property there.
    for (const key of required) {
      if (!schema.properties?.[key]) this.requiredOnly([...path, key], breadcrumb);
    }
    if (isSchema(schema.items)) {
      this.visit(schema.items, [...path, '*'], breadcrumb, uiChild(uiSchema, '*'), false);
    }
    for (const dependency of Object.values(schema.dependencies ?? {})) {
      if (Array.isArray(dependency)) {
        for (const key of dependency) this.requiredOnly([...path, key], breadcrumb);
      } else {
        this.branch(dependency, path, breadcrumb, uiSchema);
      }
    }
    const branches = [
      ...(schema.allOf ?? []),
      ...(schema.oneOf ?? []),
      ...(schema.anyOf ?? []),
      schema.then,
      schema.else,
    ];
    for (const branch of branches) this.branch(branch, path, breadcrumb, uiSchema);
  }

  private requiredOnly(path: string[], breadcrumb: string[]) {
    const key = path[path.length - 1];
    const parentLabel = breadcrumb[breadcrumb.length - 1];
    this.record(path, [...breadcrumb, humanizeKey(key)], undefined, undefined, true, parentLabel);
  }

  private branch(
    definition: JSONSchema7Definition | undefined,
    path: string[],
    breadcrumb: string[],
    uiSchema: UiSchema | undefined,
  ) {
    const schema = deref(definition, this.root, new Set());
    if (schema) this.walk(schema, path, breadcrumb, uiSchema);
  }
}

const cache = new WeakMap<object, WeakMap<object, Map<string, FieldPathInfo>>>();
const NO_UI = {};

/**
 * Every field of `schema`, keyed by path. Results are cached per schema/uiSchema
 * object, since validation-message lookups run on every validation pass.
 */
export function collectFieldPaths(
  schema: RJSFSchema,
  uiSchema?: UiSchema,
): Map<string, FieldPathInfo> {
  const uiKey = uiSchema ?? NO_UI;
  let byUi = cache.get(schema);
  const cached = byUi?.get(uiKey);
  if (cached) return cached;
  const collector = new FieldCollector(schema);
  collector.walk(schema, [], [], uiSchema);
  if (!byUi) {
    byUi = new WeakMap();
    cache.set(schema, byUi);
  }
  byUi.set(uiKey, collector.fields);
  return collector.fields;
}
