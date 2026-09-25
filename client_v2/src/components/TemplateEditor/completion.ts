/**
 * Jinja autocomplete from the server's variable spec (SPEC §9.6, DR-36).
 *
 * The describe payload (`TemplateDescription`) says which variables a kind of
 * template receives and what fields each type has. Given the text before the
 * cursor, these pure functions work out what's being typed — a variable, a
 * field after `.`, a filter after `|`, a test after `is`, a tag after `{%` —
 * resolve the type of the expression to its left (following `.field`,
 * `[0]`/`['key']`, list filters, and names from `{% for %}` / `{% set %}` /
 * `{% with %}`), and list what fits. They know nothing about Monaco;
 * `languageServices.ts` adapts them.
 */

import type { TemplateContextName, TemplateDescription, TemplateFieldDescription } from 'api-types';

/** What the cursor is in the middle of typing. */
export type CursorContext =
  | { kind: 'root'; partial: string }
  | { kind: 'member'; base: string; partial: string }
  | { kind: 'filter'; partial: string }
  | { kind: 'test'; partial: string }
  | { kind: 'tag'; partial: string };

/** A name in scope and its type. */
export type Scope = Map<string, string>;

export interface CompletionEntry {
  label: string;
  kind: 'variable' | 'field' | 'method' | 'filter' | 'test' | 'tag';
  /** Short type/signature shown beside the label. */
  detail: string;
  /** Markdown shown in the details pane. */
  documentation: string;
  insertText: string;
  /** `insertText` uses Monaco snippet syntax ($1, ${1:name}). */
  snippet?: boolean;
  /** Replace the `.` before the partial too (for `['key']` access). */
  replacesDot?: boolean;
  /** Sort earlier (e.g. an event's own form questions before generic fields). */
  sortPrefix?: string;
}

const OPENERS = ['{{', '{%', '{#'] as const;
const CLOSERS: Record<(typeof OPENERS)[number], string> = { '{{': '}}', '{%': '%}', '{#': '#}' };

/** The unclosed `{{`/`{%` the cursor is inside, and the text after it. */
function openExpression(textBefore: string): { opener: '{{' | '{%'; body: string } | null {
  let best: { opener: (typeof OPENERS)[number]; index: number } | null = null;
  for (const opener of OPENERS) {
    const index = textBefore.lastIndexOf(opener);
    if (index >= 0 && (!best || index > best.index)) best = { opener, index };
  }
  if (!best) return null;
  const after = textBefore.slice(best.index + 2);
  if (after.includes(CLOSERS[best.opener])) return null;
  if (best.opener === '{#') return null; // inside a comment
  return { opener: best.opener, body: after.replace(/^-/, '') };
}

const PATH_TAIL = /([A-Za-z_]\w*(?:\s*(?:\.\s*[A-Za-z_]\w*|\[[^\]]*\]|\([^()]*\)))*)\s*\.\s*(\w*)$/;

/** Work out what is being typed at the end of `textBefore`. */
export function getCursorContext(textBefore: string): CursorContext | null {
  const open = openExpression(textBefore);
  if (!open) return null;
  const { opener, body } = open;

  if (opener === '{%') {
    const tag = /^\s*(\w*)$/.exec(body);
    if (tag) return { kind: 'tag', partial: tag[1] };
  }
  const filter = /\|\s*(\w*)$/.exec(body);
  if (filter) return { kind: 'filter', partial: filter[1] };
  const test = /\bis\s+(?:not\s+)?(\w*)$/.exec(body);
  if (test) return { kind: 'test', partial: test[1] };
  const member = PATH_TAIL.exec(body);
  if (member) return { kind: 'member', base: member[1], partial: member[2] };
  const word = /(?:^|[^\w.'"])([A-Za-z_]\w*)?$/.exec(body);
  if (word) return { kind: 'root', partial: word[1] ?? '' };
  return null;
}

/** `list<camper>` → `camper`. */
export function elementType(type: string | undefined): string | undefined {
  const match = type ? /^list<(.+)>$/.exec(type) : null;
  return match ? match[1] : undefined;
}

export function fieldOf(
  description: TemplateDescription,
  type: string | undefined,
  name: string,
): TemplateFieldDescription | undefined {
  if (!type) return undefined;
  return description.types[type]?.fields.find((field) => field.name === name);
}

function fieldType(description: TemplateDescription, type: string | undefined, name: string) {
  return fieldOf(description, type, name)?.type;
}

/** The type after a dotted path like `registration.campers`. */
function pathType(description: TemplateDescription, type: string | undefined, path: string) {
  return path
    .split('.')
    .reduce<string | undefined>((current, part) => fieldType(description, current, part), type);
}

const SAME_TYPE_FILTERS = new Set([
  'sort',
  'selectattr',
  'rejectattr',
  'unique',
  'list',
  'reverse',
  'select',
  'reject',
  'default',
  'd',
]);
const NUMBER_FILTERS = new Set([
  'length',
  'count',
  'sum',
  'int',
  'float',
  'round',
  'abs',
  'wordcount',
]);
const STRING_FILTERS = new Set([
  'join',
  'string',
  'lower',
  'upper',
  'title',
  'capitalize',
  'trim',
  'replace',
  'truncate',
  'money',
  'date',
  'datetime',
  'csv',
  'csv_row',
  'md_cell',
  'dump',
  'tojson',
  'pprint',
  'format',
  'urlencode',
  'escape',
  'e',
  'striptags',
  'indent',
  'center',
  'wordwrap',
  'regex_replace',
]);

/** Read balanced brackets/parens starting at `text[start]`; returns the end index. */
function skipBalanced(text: string, start: number): number {
  const open = text[start];
  const close = open === '(' ? ')' : ']';
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== '\\') quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === open) {
      depth += 1;
    } else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return text.length;
}

/**
 * The type of an expression such as `registration.campers[0].lodging` or
 * `campers | selectattr('lodging') | first`, or undefined when unknown.
 */
export function resolveType(
  expression: string,
  scope: Scope,
  description: TemplateDescription,
): string | undefined {
  const text = expression.trim();
  const head = /^[A-Za-z_]\w*/.exec(text);
  if (!head) return undefined;
  let type = scope.get(head[0]);
  let i = head[0].length;

  while (i < text.length && type !== undefined) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '.') {
      const name = /^\.\s*([A-Za-z_]\w*)/.exec(text.slice(i));
      if (!name) return type;
      type = fieldType(description, type, name[1]);
      i += name[0].length;
    } else if (ch === '[') {
      const end = skipBalanced(text, i);
      const inside = text.slice(i + 1, end - 1).trim();
      const key = /^['"](.+)['"]$/.exec(inside);
      type = key ? fieldType(description, type, key[1]) : elementType(type);
      i = end;
    } else if (ch === '(') {
      i = skipBalanced(text, i); // a method call: its field type already applies
    } else if (ch === '|') {
      const filter = /^\|\s*([A-Za-z_]\w*)/.exec(text.slice(i));
      if (!filter) return undefined;
      i += filter[0].length;
      let args = '';
      const rest = text.slice(i).trimStart();
      if (rest.startsWith('(')) {
        const offset = text.length - rest.length;
        const end = skipBalanced(text, offset);
        args = text.slice(offset + 1, end - 1);
        i = end;
      }
      type = applyFilter(description, type, filter[1], args);
    } else {
      return type; // an operator or anything else ends the path
    }
  }
  return type;
}

function applyFilter(
  description: TemplateDescription,
  type: string | undefined,
  name: string,
  args: string,
): string | undefined {
  if (SAME_TYPE_FILTERS.has(name)) return type;
  if (name === 'first' || name === 'last' || name === 'min' || name === 'max') {
    return elementType(type) ?? type;
  }
  if (NUMBER_FILTERS.has(name)) return 'number';
  if (STRING_FILTERS.has(name)) return 'string';
  if (name === 'to_date') return 'date';
  if (name === 'map') {
    const attribute = /attribute\s*=\s*['"]([^'"]+)['"]/.exec(args);
    if (!attribute) return 'list<any>';
    const mapped = pathType(description, elementType(type), attribute[1]);
    return mapped ? `list<${mapped}>` : 'list<any>';
  }
  if (name === 'batch' || name === 'slice') return type ? `list<${type}>` : undefined;
  return undefined;
}

/**
 * Names in scope at the end of `textBefore`: the context's variables, the
 * globals, open `{% for %}` / `{% with %}` names (and `loop`), `{% set %}`
 * names, and macro parameters.
 */
export function collectScope(
  textBefore: string,
  description: TemplateDescription,
  context: TemplateContextName,
): Scope {
  const scope: Scope = new Map();
  for (const global of description.globals) scope.set(global.name, global.type);
  for (const root of description.contexts[context]?.roots ?? []) scope.set(root.name, root.type);

  // Open blocks: each frame holds the names it introduced.
  const frames: { tag: string; names: [string, string][] }[] = [];
  const tagPattern = /\{%-?\s*(\w+)([\s\S]*?)-?%\}/g;
  let match: RegExpExecArray | null;
  const current = () => {
    const names = new Map(scope);
    for (const frame of frames) for (const [name, type] of frame.names) names.set(name, type);
    return names;
  };

  while ((match = tagPattern.exec(textBefore)) !== null) {
    const [, tag, rest] = match;
    if (tag === 'for') {
      const loop = /^\s*([\w\s,]+?)\s+in\s+([\s\S]+?)(?:\s+if\s[\s\S]*)?$/.exec(rest);
      const names: [string, string][] = [['loop', 'loop']];
      if (loop) {
        const targets = loop[1]
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        const iterated = resolveType(loop[2], current(), description);
        if (targets.length === 1) {
          names.push([targets[0], elementType(iterated) ?? 'any']);
        } else {
          for (const target of targets) names.push([target, 'any']);
        }
      }
      frames.push({ tag: 'for', names });
    } else if (tag === 'with') {
      const names: [string, string][] = [];
      for (const assignment of rest.split(',')) {
        const parts = /^\s*(\w+)\s*=\s*([\s\S]+)$/.exec(assignment);
        if (parts) names.push([parts[1], resolveType(parts[2], current(), description) ?? 'any']);
      }
      frames.push({ tag: 'with', names });
    } else if (tag === 'macro') {
      const params = /\(([^)]*)\)/.exec(rest);
      const names: [string, string][] = (params?.[1] ?? '')
        .split(',')
        .map((p) => p.split('=')[0].trim())
        .filter(Boolean)
        .map((p) => [p, 'any']);
      frames.push({ tag: 'macro', names });
    } else if (tag === 'endfor' || tag === 'endwith' || tag === 'endmacro') {
      const opening = tag.slice(3);
      const index = frames.map((f) => f.tag).lastIndexOf(opening);
      if (index >= 0) frames.splice(index, 1);
    } else if (tag === 'set') {
      const assignment = /^\s*(\w+)\s*=\s*([\s\S]+)$/.exec(rest);
      if (assignment) {
        const type =
          resolveType(assignment[2], current(), description) ?? inferLiteral(assignment[2]);
        const target = frames.length ? frames[frames.length - 1].names : null;
        if (target) target.push([assignment[1], type]);
        else scope.set(assignment[1], type);
      }
    }
  }
  return current();
}

function inferLiteral(expression: string): string {
  const text = expression.trim();
  if (text.startsWith('[')) return 'list<any>';
  if (text.startsWith('{')) return 'dict';
  if (/^['"]/.test(text)) return 'string';
  if (/^-?\d/.test(text)) return 'number';
  return 'any';
}

function fieldDocumentation(field: TemplateFieldDescription): string {
  const parts = [field.doc];
  if (field.title && field.title !== field.doc) parts.unshift(`**${field.title}**`);
  if (field.enum?.length)
    parts.push(`One of: ${field.enum.map((v) => `\`${String(v)}\``).join(', ')}`);
  if (field.nullable) parts.push('May be empty.');
  if (field.example) parts.push(`\`\`\`jinja\n${field.example}\n\`\`\``);
  return parts.filter(Boolean).join('\n\n');
}

function fieldEntry(field: TemplateFieldDescription, kind: 'variable' | 'field'): CompletionEntry {
  const identifier = field.identifier !== false;
  const isMethod = !!field.callable;
  return {
    label: field.name,
    kind: isMethod ? 'method' : kind,
    detail: isMethod ? (field.signature ?? `${field.name}()`) : field.type,
    documentation: fieldDocumentation(field),
    insertText: !identifier
      ? `['${field.name.replace(/'/g, "\\'")}']`
      : isMethod
        ? `${field.name}($1)`
        : field.name,
    snippet: isMethod,
    replacesDot: !identifier,
    // Event-specific form questions first, then fields in spec order.
    sortPrefix: field.title ? '0' : '1',
  };
}

/** What to offer for a cursor context. */
export function completionEntries(
  cursor: CursorContext,
  scope: Scope,
  description: TemplateDescription,
): CompletionEntry[] {
  switch (cursor.kind) {
    case 'member': {
      const type = resolveType(cursor.base, scope, description);
      const fields = type ? (description.types[type]?.fields ?? []) : [];
      return fields.map((field) => fieldEntry(field, 'field'));
    }
    case 'root': {
      const known = new Map(
        [
          ...(description.globals ?? []),
          ...Object.values(description.contexts).flatMap((c) => c.roots),
        ].map((field) => [field.name, field]),
      );
      return [...scope].map(([name, type]) => {
        const field = known.get(name);
        return field && field.type === type
          ? fieldEntry(field, 'variable')
          : {
              label: name,
              kind: 'variable' as const,
              detail: type,
              documentation: '',
              insertText: name,
            };
      });
    }
    case 'filter':
      return description.filters.map((filter) => ({
        label: filter.name,
        kind: 'filter' as const,
        detail: filter.signature,
        documentation: `${filter.doc}\n\n\`\`\`jinja\n${filter.example}\n\`\`\``,
        insertText: filter.name,
        sortPrefix: filter.builtin ? '1' : '0',
      }));
    case 'test':
      return description.tests.map((test) => ({
        label: test.name,
        kind: 'test' as const,
        detail: 'test',
        documentation: `${test.doc}\n\n\`\`\`jinja\n${test.example}\n\`\`\``,
        insertText: test.name,
      }));
    case 'tag':
      return description.tags.map((tag) => ({
        label: tag.name,
        kind: 'tag' as const,
        detail: 'tag',
        documentation: tag.doc,
        // The snippet includes its own {% %}; typed after "{%", drop the opener.
        insertText: tag.snippet.replace(/^\{%-?\s*/, ''),
        snippet: true,
      }));
  }
}
