/**
 * Human-readable rows for form data (SPEC §7.2, DR-33), built from the form
 * schema and uiSchema: field titles label the rows, `ui:enumNames`/`oneOf`
 * titles replace raw enum values, booleans read Yes/No, arrays of choices are
 * joined, nested objects (address, emergency contact, lodging) become indented
 * groups, a requested lodging shows its name, hidden widgets and empty values
 * are skipped, and rows follow `ui:order`. Conditional fields (`$ref`,
 * `dependencies`, `if/then`) are resolved against the data with rjsf's own
 * `retrieveSchema`, so the rows are exactly the fields the form showed. Used by
 * the registration review and the lodging screen's camper details (§8.6).
 */

import { getUiOptions, retrieveSchema, type UiSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import type { Hash } from 'api-types';
import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';

/** One row of the review: a scalar (`text`) or a nested group (`children`). */
export interface ReviewItem {
  label: string;
  text?: string;
  children?: ReviewItem[];
}

export const isPlainObject = (value: unknown): value is Hash =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isEmpty = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0) ||
  (isPlainObject(value) && Object.keys(value).length === 0);

/** Resolve `$ref`, `dependencies`, `allOf` and `if/then` against the data. */
function resolve(
  schema: JSONSchema7Definition | undefined,
  root: JSONSchema7,
  data: unknown,
): JSONSchema7 {
  if (!schema || typeof schema === 'boolean') return {};
  return retrieveSchema(validator, schema, root, data);
}

/**
 * Sort keys by `ui:order`; keys it doesn't mention go where its `*` is (or at
 * the end). Unlike rjsf's orderProperties this tolerates listed fields that are
 * absent, which is routine for conditional fields.
 */
function orderKeys(keys: string[], order: unknown): string[] {
  if (!Array.isArray(order)) return keys;
  const star = order.indexOf('*');
  const rank = (key: string) => {
    const index = order.indexOf(key);
    if (index >= 0) return index;
    return star >= 0 ? star : order.length;
  };
  return [...keys].sort((a, b) => rank(a) - rank(b) || keys.indexOf(a) - keys.indexOf(b));
}

/**
 * The display name of an enum/const value: `ui:enumNames` (an array matched
 * by index, or a map matched by value) or a `oneOf`/`anyOf` title.
 */
function enumLabel(schema: JSONSchema7, uiSchema: UiSchema, value: unknown): string | undefined {
  const byIndex = (names: unknown[]) => {
    const index = schema.enum ? schema.enum.findIndex((option) => option === value) : -1;
    const name = index >= 0 ? names[index] : undefined;
    return typeof name === 'string' ? name : undefined;
  };

  const uiNames: unknown = getUiOptions(uiSchema).enumNames;
  if (Array.isArray(uiNames)) {
    const name = byIndex(uiNames as unknown[]);
    if (name !== undefined) return name;
  } else if (isPlainObject(uiNames)) {
    const name = uiNames[String(value)];
    if (typeof name === 'string') return name;
  }

  for (const alternative of schema.oneOf ?? schema.anyOf ?? []) {
    if (typeof alternative !== 'boolean' && alternative.const === value && alternative.title) {
      return alternative.title;
    }
  }
  return undefined;
}

function scalarText(schema: JSONSchema7, uiSchema: UiSchema, value: unknown): string {
  const label = enumLabel(schema, uiSchema, value);
  if (label !== undefined) return label;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : JSON.stringify(value);
}

function reviewItem(
  label: string,
  schema: JSONSchema7,
  uiSchema: UiSchema,
  value: unknown,
  root: JSONSchema7,
): ReviewItem | null {
  if (Array.isArray(value)) {
    const itemSchema = Array.isArray(schema.items) ? undefined : schema.items;
    if (!value.some(isPlainObject)) {
      const resolved = resolve(itemSchema, root, undefined);
      return {
        label,
        text: value.map((entry) => scalarText(resolved, uiSchema, entry)).join(', '),
      };
    }
    const itemUi = (uiSchema.items ?? {}) as UiSchema;
    const children = value.flatMap((entry, index) => {
      if (!isPlainObject(entry)) return [];
      const resolved = resolve(itemSchema, root, entry);
      const rows = reviewItems(resolved, itemUi, entry, root);
      return rows.length
        ? [{ label: `${resolved.title ?? label} ${index + 1}`, children: rows }]
        : [];
    });
    return children.length ? { label, children } : null;
  }

  if (isPlainObject(value)) {
    // A requested lodging is {choices, id, name}; the name is what the
    // registrant picked.
    if (getUiOptions(uiSchema).field === 'LodgingRequested') {
      return typeof value.name === 'string' && value.name ? { label, text: value.name } : null;
    }
    const children = reviewItems(schema, uiSchema, value, root);
    return children.length ? { label, children } : null;
  }

  return { label, text: scalarText(schema, uiSchema, value) };
}

/** Build the review rows for an object's data against its (unresolved) schema. */
export function reviewItems(
  schema: JSONSchema7Definition | undefined,
  uiSchema: UiSchema,
  data: Hash,
  root: JSONSchema7,
  omit: string[] = [],
): ReviewItem[] {
  const resolved = resolve(schema, root, data);
  const properties = resolved.properties ?? {};
  const keys = orderKeys(
    [...new Set([...Object.keys(properties), ...Object.keys(data)])],
    uiSchema['ui:order'],
  );

  const items: ReviewItem[] = [];
  for (const key of keys) {
    const value = data[key];
    if (omit.includes(key) || isEmpty(value)) continue;
    const fieldUi = (uiSchema[key] ?? {}) as UiSchema;
    const options = getUiOptions(fieldUi);
    if (options.widget === 'hidden') continue;
    const fieldSchema = resolve(properties[key], root, value);
    const label = String(options.title ?? fieldSchema.title ?? key);
    const item = reviewItem(label, fieldSchema, fieldUi, value, root);
    if (item) items.push(item);
  }
  return items;
}
