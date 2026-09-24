/**
 * Validation messages (SPEC §7.1, §9.1, DR-34). Turns rjsf/ajv validation
 * errors into plain-language messages, using the event's own messages where it
 * has one:
 *
 *   { "campers.*.lodging.lodging_requested.id": { "required": "{{camper}}: …" },
 *     "*": { "required": "{{field}} is required" } }
 *
 * Keys are an error's `property` with the leading `.` removed and array indexes
 * written as `*`; values map an ajv keyword to a Handlebars message. Lookup
 * order: the field's own rule → the event's `*` default for that keyword → the
 * built-in default → a readable fallback. `dependencies` errors are looked up
 * as `required`.
 *
 * Both `message` (shown under the field) and `stack` (shown in the error list
 * at the top of the form) are rewritten; `property`, `name`, `params` and
 * `schemaPath` are left intact because inline placement and focus rely on them.
 * Errors are never removed — rjsf blocks submission only while the list is
 * non-empty — so noise is blanked instead: the "must match exactly one schema"
 * / branch-discriminator errors a failed `dependencies`/`if` branch produces
 * next to the real error, and exact duplicates.
 *
 * With the `DEBUG` localStorage flag set, each validation pass is traced to the
 * console: the raw errors, the context, and which key (if any) each matched.
 */

import type { RJSFSchema, RJSFValidationError, UiSchema } from '@rjsf/utils';
import type { RegistrationErrorMessages } from 'api-types';
import { checkTemplate, renderPlainTextTemplate } from 'components/templating';
import { debug, isDebugEnabled } from 'utils/debug';
import { ordinal } from 'utils/ordinal';

import { collectFieldPaths, type ErrorKeyword, humanizeKey } from './schemaPaths';

/** Where a message came from. */
export type MessageSource = 'event rule' | 'event "*" default' | 'built-in default';

export interface BuiltInMessage {
  keyword: string;
  /** Only applies when this returns true for the error's params. */
  when?: (params: Record<string, unknown>) => boolean;
  template: string;
}

/**
 * The app's own messages, used when the event has no rule for an error. The
 * first entry whose keyword (and `when`) matches wins.
 */
export const BUILT_IN_MESSAGES: BuiltInMessage[] = [
  { keyword: 'required', template: 'This field is required' },
  {
    keyword: 'format',
    when: (params) => params.format === 'email',
    template: 'Please enter a valid email address',
  },
  {
    keyword: 'type',
    when: (params) => params.type === 'number' || params.type === 'integer',
    template: 'Please enter a number',
  },
  { keyword: 'pattern', template: 'Please check the format of this answer' },
  { keyword: 'enum', template: 'Please choose one of the options' },
  { keyword: 'minLength', template: 'Please enter at least {{params.limit}} characters' },
  { keyword: 'maxLength', template: 'Please enter no more than {{params.limit}} characters' },
  { keyword: 'minimum', template: 'Please enter {{params.limit}} or more' },
  { keyword: 'maximum', template: 'Please enter {{params.limit}} or less' },
  { keyword: 'minItems', template: 'Please choose at least {{params.limit}}' },
  { keyword: 'maxItems', template: 'Please choose no more than {{params.limit}}' },
];

/** Plain-language names for the keywords, for the admin editor. */
export const KEYWORD_LABELS: Record<ErrorKeyword, string> = {
  required: 'Missing (required)',
  pattern: "Doesn't match the expected pattern",
  format: 'Wrong format (e.g. email address)',
  enum: 'Not one of the allowed choices',
  const: 'Not the required value',
  type: 'Not a number',
  minimum: 'Below the minimum',
  maximum: 'Above the maximum',
  exclusiveMinimum: 'Not above the minimum',
  exclusiveMaximum: 'Not below the maximum',
  multipleOf: 'Not a multiple of the step',
  minLength: 'Too short',
  maxLength: 'Too long',
  minItems: 'Too few chosen',
  maxItems: 'Too many chosen',
  uniqueItems: 'Duplicate choices',
};

export interface ErrorMessageContext {
  /** The event's rules (`registration_error_messages`). */
  rules?: RegistrationErrorMessages;
  /**
   * Prepended to every error path before looking rules up, for forms that
   * render part of the registration: the admin camper form uses `campers.*`.
   */
  pathPrefix?: string;
  /** The camper a single-camper form is editing, for `{{camper}}`. */
  camper?: { label?: string };
  /** The form's current data (campers' names for `{{camper}}`). */
  formData?: unknown;
  /** The form's root schema and uiSchema (field labels for `{{field}}`). */
  schema?: RJSFSchema;
  uiSchema?: UiSchema;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * An error's lookup key: `.campers.0.lodging.lodging_requested.id` →
 * `campers.*.lodging.lodging_requested.id`. Root-level required errors carry no
 * leading dot (`registrant_email`). A form-level error has an empty path.
 */
export function normalizeErrorPath(property: string | undefined, prefix?: string): string {
  const trimmed = (property ?? '').replace(/^\./, '');
  const path = trimmed
    ? trimmed
        .split('.')
        .map((segment) => (/^\d+$/.test(segment) ? '*' : segment))
        .join('.')
    : '';
  if (!prefix) return path;
  return path ? `${prefix}.${path}` : prefix;
}

/** "2nd camper (Child Miles)" — from the camper's position and name. */
export function camperLabel(index: number | undefined, camper: unknown, explicit?: string) {
  if (explicit) return `Camper (${explicit})`;
  if (index === undefined) return '';
  const name = isRecord(camper)
    ? [camper.first_name, camper.last_name]
        .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
        .join(' ')
    : '';
  const position = `${ordinal(index + 1)} camper`;
  return name ? `${position} (${name})` : position;
}

/** The camper index an error belongs to, from its (raw) property. */
function camperIndex(property: string | undefined): number | undefined {
  const match = /^\.?campers\.(\d+)(\.|$)/.exec(property ?? '');
  return match ? Number(match[1]) : undefined;
}

interface Match {
  template: string;
  source: MessageSource;
  key: string;
  keyword: string;
}

function findMessage(
  rules: RegistrationErrorMessages | undefined,
  path: string,
  keyword: string,
  params: Record<string, unknown>,
): Match | undefined {
  const own = path ? rules?.[path]?.[keyword] : undefined;
  if (own) return { template: own, source: 'event rule', key: path, keyword };
  const eventDefault = rules?.['*']?.[keyword];
  if (eventDefault) return { template: eventDefault, source: 'event "*" default', key: '*', keyword };
  return builtInMatch(keyword, params);
}

function builtInMatch(keyword: string, params: Record<string, unknown>): Match | undefined {
  const builtIn = BUILT_IN_MESSAGES.find(
    (entry) => entry.keyword === keyword && (!entry.when || entry.when(params)),
  );
  return builtIn
    ? { template: builtIn.template, source: 'built-in default', key: '(built-in)', keyword }
    : undefined;
}

/** The first built-in message for a keyword (e.g. as a placeholder in the editor). */
export function builtInTemplate(keyword: string): string | undefined {
  return BUILT_IN_MESSAGES.find((entry) => entry.keyword === keyword)?.template;
}

/** Summary errors a failed `oneOf`/`anyOf`/`if` produces alongside the real one. */
const SUMMARY_KEYWORDS = new Set(['oneOf', 'anyOf', 'if', 'not']);

/**
 * Whether an error is noise next to the others: a combinator summary, or a
 * `const`/`enum` failure inside a `oneOf`/`anyOf` branch (the "which branch
 * applies" discriminator), when another error sits at or under the same
 * object. On its own, such an error is kept — it's then the only signal.
 */
function noiseReason(error: RJSFValidationError, errors: RJSFValidationError[]) {
  const name = error.name ?? '';
  const property = error.property ?? '';
  let scope: string | undefined;
  if (SUMMARY_KEYWORDS.has(name)) {
    scope = property;
  } else if (
    (name === 'const' || name === 'enum') &&
    /\/(oneOf|anyOf)\/\d+\//.test(error.schemaPath ?? '')
  ) {
    scope = property.slice(0, Math.max(0, property.lastIndexOf('.')));
  }
  if (scope === undefined) return undefined;
  const sibling = errors.some(
    (other) =>
      other !== error &&
      !SUMMARY_KEYWORDS.has(other.name ?? '') &&
      !(other.name === 'const' || other.name === 'enum') &&
      (other.property ?? '').startsWith(scope),
  );
  return sibling
    ? `blanked: "${name}" summary of a conditional branch, next to a more specific error`
    : undefined;
}

interface TraceEntry {
  raw: Pick<RJSFValidationError, 'name' | 'property' | 'message' | 'stack' | 'params' | 'schemaPath'>;
  lookupPath: string;
  keyword: string;
  outcome: string;
  matched?: { key: string; keyword: string; source: MessageSource };
  message: string;
  stack: string;
  notes: string[];
}

/**
 * Rewrite rjsf validation errors into the event's (or the built-in) messages.
 * Returns a new array of the same length.
 */
export function resolveErrorMessages(
  errors: RJSFValidationError[],
  context: ErrorMessageContext = {},
): RJSFValidationError[] {
  const { rules, pathPrefix, camper, formData, schema, uiSchema } = context;
  const fields = schema ? collectFieldPaths(schema, uiSchema) : undefined;
  const campers = isRecord(formData) && Array.isArray(formData.campers) ? formData.campers : [];
  const trace: TraceEntry[] = [];
  const seen = new Set<string>();

  const resolved = errors.map((error) => {
    const notes: string[] = [];
    const localPath = normalizeErrorPath(error.property);
    const lookupPath = normalizeErrorPath(error.property, pathPrefix);
    const keyword = error.name === 'dependencies' ? 'required' : error.name ?? '';
    const params: Record<string, unknown> = isRecord(error.params) ? error.params : {};
    const record = (entry: Omit<TraceEntry, 'raw' | 'lookupPath' | 'keyword' | 'notes'>) =>
      trace.push({
        raw: {
          name: error.name,
          property: error.property,
          message: error.message,
          stack: error.stack,
          params,
          schemaPath: error.schemaPath,
        },
        lookupPath,
        keyword,
        notes,
        ...entry,
      });

    const noise = noiseReason(error, errors);
    if (noise) {
      notes.push(noise);
      record({ outcome: 'suppressed', message: '', stack: '' });
      return { ...error, message: '', stack: '' };
    }

    const index = camperIndex(error.property);
    const camperText =
      camperLabel(index, index === undefined ? undefined : campers[index], camper?.label) || '';
    const segments = localPath.split('.');
    const fieldText =
      fields?.get(localPath)?.label ?? humanizeKey(segments[segments.length - 1] || 'This field');
    const vars = {
      field: fieldText,
      camper: camperText,
      camperNumber: index === undefined ? undefined : index + 1,
      params,
    };

    let match = findMessage(rules, lookupPath, keyword, params);
    let message: string | undefined;
    if (match) {
      try {
        message = renderPlainTextTemplate(match.template, vars).trim();
      } catch (renderError) {
        notes.push(
          `template error in ${match.source} "${match.template}": ${String(renderError)} — using the built-in message`,
        );
        match = match.source === 'built-in default' ? undefined : builtInMatch(keyword, params);
        message = match ? renderPlainTextTemplate(match.template, vars).trim() : undefined;
      }
    }
    const text = message || error.message || 'Please check this answer';

    // The list at the top is detached from the fields, so it needs context the
    // inline message doesn't — unless the message already names them.
    const template = match?.template ?? '';
    const named = /\{\{\s*(camper|field)\b/.test(template);
    const context = [camperText, localPath ? fieldText : ''].filter(Boolean);
    const stack = named || context.length === 0 ? text : `${context.join(' – ')}: ${text}`;

    const duplicateKey = `${error.property ?? ''}\u0000${text}`;
    if (seen.has(duplicateKey)) {
      notes.push('blanked: duplicate of an earlier error on the same field');
      record({ outcome: 'suppressed', message: '', stack: '' });
      return { ...error, message: '', stack: '' };
    }
    seen.add(duplicateKey);

    record(
      match
        ? {
            outcome: 'matched',
            matched: { key: match.key, keyword: match.keyword, source: match.source },
            message: text,
            stack,
          }
        : { outcome: 'no match — fallback', message: text, stack },
    );
    return { ...error, message: text, stack };
  });

  if (isDebugEnabled() && errors.length) {
    debug(`validation: ${errors.length} error${errors.length === 1 ? '' : 's'}`, {
      context: {
        pathPrefix,
        camper,
        rules: Object.keys(rules ?? {}).length,
        formData,
      },
      errors: trace,
    });
  }

  return resolved;
}

export interface ErrorMessageRule {
  path: string;
  keyword: string;
  message: string;
}

/** The map as a sorted list of rules (`*` defaults first). */
export function rulesToList(rules: RegistrationErrorMessages | undefined): ErrorMessageRule[] {
  return Object.entries(rules ?? {})
    .flatMap(([path, byKeyword]) =>
      Object.entries(byKeyword).map(([keyword, message]) => ({ path, keyword, message })),
    )
    .sort(
      (a, b) =>
        Number(b.path === '*') - Number(a.path === '*') ||
        a.path.localeCompare(b.path) ||
        a.keyword.localeCompare(b.keyword),
    );
}

/** A copy of the map with `rule` set (replacing `previous` when editing). */
export function setRule(
  rules: RegistrationErrorMessages,
  rule: ErrorMessageRule,
  previous?: Pick<ErrorMessageRule, 'path' | 'keyword'>,
): RegistrationErrorMessages {
  const next = previous ? removeRule(rules, previous) : { ...rules };
  next[rule.path] = { ...(next[rule.path] ?? {}), [rule.keyword]: rule.message };
  return next;
}

/** A copy of the map without the rule (and without an emptied path). */
export function removeRule(
  rules: RegistrationErrorMessages,
  { path, keyword }: Pick<ErrorMessageRule, 'path' | 'keyword'>,
): RegistrationErrorMessages {
  const next = { ...rules };
  const { [keyword]: _removed, ...rest } = next[path] ?? {};
  if (Object.keys(rest).length) next[path] = rest;
  else delete next[path];
  return next;
}

export interface RuleProblems {
  /** Problems that must be fixed before saving. */
  errors: string[];
  /** Worth a look, but saving is allowed (e.g. a path the form doesn't have yet). */
  warnings: string[];
}

/**
 * Check a rules map: the same shape the server enforces, valid templates, and
 * paths the form actually has (`knownPaths`; unknown ones only warn, since a
 * field may be added to the schema later).
 */
export function validateRules(rules: unknown, knownPaths?: Set<string>): RuleProblems {
  const problems: RuleProblems = { errors: [], warnings: [] };
  if (!isRecord(rules)) {
    problems.errors.push('Must be an object of { "field path": { "error type": "message" } }');
    return problems;
  }
  for (const [path, byKeyword] of Object.entries(rules)) {
    if (!path.trim()) {
      problems.errors.push('A field path is empty');
      continue;
    }
    if (!isRecord(byKeyword)) {
      problems.errors.push(`"${path}" must map error types to messages`);
      continue;
    }
    if (knownPaths && path !== '*' && !knownPaths.has(path)) {
      problems.warnings.push(`"${path}" isn't a field on the registration form`);
    }
    for (const [keyword, message] of Object.entries(byKeyword)) {
      if (!keyword.trim()) problems.errors.push(`"${path}": an error type is empty`);
      if (typeof message !== 'string' || !message.trim()) {
        problems.errors.push(`"${path}" / "${keyword}": the message is empty`);
        continue;
      }
      const templateError = checkTemplate(message);
      if (templateError) {
        problems.errors.push(`"${path}" / "${keyword}": ${templateError}`);
      }
    }
  }
  return problems;
}
