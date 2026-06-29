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
