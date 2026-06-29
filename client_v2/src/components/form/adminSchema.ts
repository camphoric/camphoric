/**
 * Admin vs. registrant form derivation (SPEC §9.5). The same JSON Schemas drive
 * both surfaces; admin editing uses a transformed UI schema that strips
 * registrant-only constraints (notably `enumDisabled`, so admins can pick
 * options that are disabled for registrants) and a schema that includes the
 * shared `definitions` for referenced types. There is a single schema source of
 * truth; the admin variants are derived from it.
 */

import type { RJSFSchema, UiSchema } from '@rjsf/utils';

type JsonValue = unknown;

/** One named admin-attribute group: a data schema and its UI schema. */
interface AdminSchemaEntry {
  data: RJSFSchema;
  ui?: UiSchema;
}

/** Recursively drop `enumDisabled` (in any form) from a UI schema. */
function stripEnumDisabled(node: JsonValue): JsonValue {
  if (Array.isArray(node)) {
    return node.map(stripEnumDisabled);
  }
  if (node && typeof node === 'object') {
    const result: Record<string, JsonValue> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === 'ui:enumDisabled' || key === 'enumDisabled') continue;
      result[key] = stripEnumDisabled(value);
    }
    return result;
  }
  return node;
}

/** Derive the admin UI schema from the registrant UI schema. */
export function deriveAdminUiSchema(uiSchema: UiSchema): UiSchema {
  return stripEnumDisabled(uiSchema) as UiSchema;
}

/**
 * Combine a `*_admin_schema` map — `{ key: { data, ui } }` — into a single
 * object schema and UI schema for the admin-only attributes form (SPEC §8.4,
 * §8.5). Each entry becomes a property; the fields are ordered by each entry's
 * data-schema `title`.
 */
export function combineAdminSchema(adminSchema: Record<string, unknown>): {
  schema: RJSFSchema;
  uiSchema: UiSchema;
} {
  const entries = Object.entries(adminSchema).filter(
    (entry): entry is [string, AdminSchemaEntry] =>
      !!entry[1] && typeof entry[1] === 'object' && 'data' in entry[1],
  );

  const properties: Record<string, RJSFSchema> = {};
  const uiSchema: UiSchema = {};
  for (const [key, { data, ui }] of entries) {
    properties[key] = data;
    if (ui) uiSchema[key] = ui;
  }

  uiSchema['ui:order'] = entries
    .slice()
    .sort(([, a], [, b]) => (a.data.title ?? '').localeCompare(b.data.title ?? ''))
    .map(([key]) => key);

  return { schema: { type: 'object', properties }, uiSchema };
}

/**
 * Inject shared `definitions` into a schema so `$ref`s to referenced types
 * resolve (e.g. editing a camper in admin needs the registration schema's
 * definitions). The schema's own definitions win on conflict.
 */
export function injectDefinitions(
  schema: RJSFSchema,
  definitions: RJSFSchema['definitions'] | undefined,
): RJSFSchema {
  if (!definitions) return schema;
  return {
    ...schema,
    definitions: { ...definitions, ...schema.definitions },
  };
}
