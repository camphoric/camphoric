/**
 * Hover docs for Jinja templates (SPEC §9.6, DR-36): what the word under the
 * pointer is — a variable, a field, a filter, a test or a tag — with its type,
 * doc and example, from the server's variable spec.
 */

import type { TemplateContextName, TemplateDescription } from 'api-types';

import { collectScope, fieldOf, getCursorContext, resolveType } from './completion';

function example(code: string | undefined) {
  return code ? `\`\`\`jinja\n${code}\n\`\`\`` : '';
}

/** A one-line summary of a type, e.g. "A camper — one person registered…". */
function typeSummary(description: TemplateDescription, type: string): string {
  const element = /^list<(.+)>$/.exec(type)?.[1];
  const described = description.types[element ?? type];
  if (!described?.doc) return '';
  return element ? `Each item: ${described.doc}` : described.doc;
}

/**
 * Markdown for the word ending at the end of `textToWordEnd`, or null when
 * there's nothing to say (plain text, an unknown name, a keyword).
 */
export function hoverMarkdown(
  textToWordEnd: string,
  description: TemplateDescription,
  context: TemplateContextName,
): string | null {
  const cursor = getCursorContext(textToWordEnd);
  if (!cursor || !cursor.partial) return null;
  const name = cursor.partial;

  switch (cursor.kind) {
    case 'filter': {
      const filter = description.filters.find((f) => f.name === name);
      return filter
        ? [`**filter** \`${filter.signature}\``, filter.doc, example(filter.example)]
            .filter(Boolean)
            .join('\n\n')
        : null;
    }
    case 'test': {
      const test = description.tests.find((t) => t.name === name);
      return test
        ? [`**test** \`${test.name}\``, test.doc, example(test.example)]
            .filter(Boolean)
            .join('\n\n')
        : null;
    }
    case 'tag': {
      const tag = description.tags.find((t) => t.name === name);
      return tag ? [`**tag** \`${tag.name}\``, tag.doc].join('\n\n') : null;
    }
    case 'member': {
      const scope = collectScope(textToWordEnd, description, context);
      const owner = resolveType(cursor.base, scope, description);
      const field = fieldOf(description, owner, name);
      if (!field) return null;
      const heading = field.callable
        ? `\`${owner}.${field.signature ?? `${field.name}()`}\` → \`${field.type}\``
        : `\`${owner}.${field.name}\`: \`${field.type}\`${field.nullable ? ' (may be empty)' : ''}`;
      return [
        heading,
        field.title && field.title !== field.doc ? `**${field.title}**` : '',
        field.doc,
        field.enum?.length ? `One of: ${field.enum.map((v) => `\`${String(v)}\``).join(', ')}` : '',
        example(field.example),
        typeSummary(description, field.type),
      ]
        .filter(Boolean)
        .join('\n\n');
    }
    case 'root': {
      const scope = collectScope(textToWordEnd, description, context);
      const type = scope.get(name);
      if (!type) return null;
      const known = [...(description.contexts[context]?.roots ?? []), ...description.globals].find(
        (field) => field.name === name && field.type === type,
      );
      return [
        known?.callable ? `\`${known.signature ?? `${name}()`}\`` : `\`${name}\`: \`${type}\``,
        known?.doc ?? '',
        example(known?.example),
        typeSummary(description, type),
      ]
        .filter(Boolean)
        .join('\n\n');
    }
  }
}
