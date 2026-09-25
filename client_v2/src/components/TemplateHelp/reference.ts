/**
 * The Template Help reference, computed from the server's variable spec
 * (SPEC §9.3, DR-36): which types a kind of template can reach, searching
 * variables, fields, filters and tests, and the template that downloads a
 * context's sample variables.
 */

import type { TemplateContextName, TemplateDescription, TemplateFieldDescription } from 'api-types';

/** The object type a field type refers to (`list<camper>` → `camper`), if any. */
export function referencedType(description: TemplateDescription, type: string): string | undefined {
  const inner = /^list<(.+)>$/.exec(type)?.[1] ?? type;
  return description.types[inner] ? inner : undefined;
}

/**
 * Every type reachable from a context's variables, in the order a reader
 * meets them (breadth first, fields in spec order).
 */
export function reachableTypes(
  description: TemplateDescription,
  context: TemplateContextName,
): string[] {
  const roots = description.contexts[context]?.roots ?? [];
  const seen: string[] = [];
  const queue = roots.map((root) => root.type);
  while (queue.length) {
    const type = referencedType(description, queue.shift()!);
    if (!type || seen.includes(type)) continue;
    seen.push(type);
    for (const field of description.types[type].fields) queue.push(field.type);
  }
  return seen;
}

/** Event-specific types (the event's own form questions and pricing). */
export function isEventType(type: string) {
  return type.includes(':');
}

function matches(query: string, ...texts: (string | undefined)[]) {
  return texts.some((text) => text?.toLowerCase().includes(query));
}

function fieldMatches(query: string, field: TemplateFieldDescription) {
  return matches(query, field.name, field.doc, field.title, field.type);
}

export interface ReferenceSection {
  /** A type name, or `variables` for the context's own variables. */
  id: string;
  title: string;
  doc: string;
  fields: TemplateFieldDescription[];
}

/**
 * The context's variables and each reachable type, with only the fields
 * matching `query` (all of them when it's blank). Sections left empty by the
 * search are dropped — unless the type's own name matches.
 */
export function variableSections(
  description: TemplateDescription,
  context: TemplateContextName,
  query = '',
): ReferenceSection[] {
  const q = query.trim().toLowerCase();
  const contextDescription = description.contexts[context];
  const sections: ReferenceSection[] = [
    {
      id: 'variables',
      title: `${contextDescription?.title ?? context} variables`,
      doc: contextDescription?.doc ?? '',
      fields: contextDescription?.roots ?? [],
    },
    ...reachableTypes(description, context).map((type) => ({
      id: type,
      title: type,
      doc: description.types[type].doc,
      fields: description.types[type].fields,
    })),
  ];
  if (!q) return sections;
  return sections
    .map((section) =>
      matches(q, section.title)
        ? section
        : { ...section, fields: section.fields.filter((field) => fieldMatches(q, field)) },
    )
    .filter((section) => section.fields.length);
}

export function searchFilters(description: TemplateDescription, query = '') {
  const q = query.trim().toLowerCase();
  return description.filters.filter((f) => !q || matches(q, f.name, f.doc, f.signature));
}

export function searchTests(description: TemplateDescription, query = '') {
  const q = query.trim().toLowerCase();
  return description.tests.filter((t) => !q || matches(q, t.name, t.doc));
}

export function searchTags(description: TemplateDescription, query = '') {
  const q = query.trim().toLowerCase();
  return description.tags.filter((t) => !q || matches(q, t.name, t.doc));
}

/** How many items of each list variable the sample download includes. */
export const SAMPLE_LIST_ITEMS = 3;

/**
 * A template that prints a context's variables as JSON, for "Download sample
 * variables": each variable, lists cut to their first few items, Camphoric
 * objects two levels deep (deeper links become `{"$ref": "camper:12"}`).
 */
export function sampleVariablesTemplate(
  description: TemplateDescription,
  context: TemplateContextName,
): string {
  const roots = description.contexts[context]?.roots ?? [];
  const entries = roots.map((root) =>
    root.type.startsWith('list<')
      ? `${root.name}=${root.name}[:${SAMPLE_LIST_ITEMS}]`
      : `${root.name}=${root.name}`,
  );
  return `{{ dict(${entries.join(', ')}) | dump(2) }}`;
}
