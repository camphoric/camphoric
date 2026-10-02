/**
 * Turning audit entries (SPEC §5; §15, DR-53) into words: what happened to what,
 * and each changed field as "Title: old → new". JSON fields (attributes, stay,
 * …) are compared key by key, so only what changed is shown; a price shows as
 * its total before and after. A structured or multi-line value too long to read
 * whole comes with a line-by-line diff of what changed.
 */

import type { ApiHistoryEntry, Hash } from 'api-types';
import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { formatMoney } from 'utils/money';

export interface ChangeLine {
  field: string;
  from: string;
  to: string;
  /** For long JSON or multi-line text: what changed, line by line. */
  diff?: DiffLine[];
}

/** A line of a diff, or a run of unchanged lines left out. */
export type DiffLine =
  { kind: 'same' | 'removed' | 'added'; text: string } | { kind: 'skip'; count: number };

/** Values longer than this (as text) are cut short, or diffed if they're structured. */
export const VALUE_LIMIT = 120;
/** Unchanged lines kept around each change in a diff. */
const CONTEXT = 2;
/** Past this many line pairs, the changed middle is shown as removed then added. */
const MAX_DIFF_CELLS = 4_000_000;

export interface DescribeOptions {
  /**
   * Name every object in full, the registration too — for a list that spans
   * registrations and events (a user's changes) rather than one registration's.
   */
  nameEveryObject?: boolean;
  /** Field titles by object type, then by attribute path (`address.city`). */
  titles?: Record<string, Record<string, string>>;
  /** Names for ids, by field: `lodging`, `registration_type`, … */
  lookups?: Record<string, Record<string, string>>;
}

const TYPE_NAMES: Record<string, string> = {
  registration: 'Registration',
  camper: 'Camper',
  payment: 'Payment',
  customcharge: 'Custom charge',
  pricingoverride: 'Price override',
  organization: 'Organization',
  event: 'Event',
  registrationtype: 'Registration type',
  report: 'Report',
  invitation: 'Invitation',
  lodging: 'Lodging',
  customchargetype: 'Charge type',
  deposit: 'Deposit',
  promocode: 'Promo code',
  emailaccount: 'Email account',
  emailtemplate: 'Email template',
  emailunsubscribe: 'Unsubscribe',
  user: 'User',
  useraccount: 'User account',
};

// Labels that already say what they are: "Registration #5 (Lark Camp)".
const SELF_NAMED = new Set(['registration', 'report']);

// Model fields by what they're called; attributes are named by their schema.
const FIELD_NAMES: Record<string, string> = {
  registrant_email: 'Registrant email',
  registration_type: 'Registration type',
  promo_code: 'Promo code',
  payment_type: 'Payment type',
  completed: 'Finished registering',
  initial_payment: 'Initial payment',
  lodging: 'Lodging',
  lodging_requested: 'Requested lodging',
  lodging_reserved: 'Reserved spot',
  lodging_shared: 'Sharing',
  lodging_shared_with: 'Sharing with',
  lodging_comments: 'Lodging comments',
  stay: 'Stay',
  sequence: 'Order',
  amount: 'Amount',
  paid_on: 'Paid on',
  notes: 'Notes',
  deposit: 'Deposit',
  custom_charge_type: 'Charge type',
  var: 'Line',
  reason: 'Reason',
};

// Recorded but not worth showing: the action says it, or it never changes by hand.
const HIDDEN = new Set(['id', 'uuid', 'event', 'registration', 'camper', 'deleted_at']);
const PRICES = new Set(['server_pricing_results', 'client_reported_pricing']);
const MONEY = new Set(['amount']);
// JSON fields shown key by key, and what their keys are prefixed with.
const ATTRIBUTE_FIELDS: Record<string, string> = { attributes: '', admin_attributes: 'Admin: ' };

/**
 * "Camper “Pat Alpha”", or just "Registration" for the registration itself —
 * unless every object is named, when it's "Registration #5 (Lark Camp)".
 */
export function objectName(entry: ApiHistoryEntry, options: DescribeOptions = {}): string {
  const { type: model, label } = entry.object;
  if (options.nameEveryObject && SELF_NAMED.has(model)) return label;
  const type = TYPE_NAMES[model] ?? humanize(model);
  return model === 'registration' ? type : `${type} “${label}”`;
}

export function actionName(entry: ApiHistoryEntry): string {
  return { create: 'Created', update: 'Changed', delete: 'Deleted', restore: 'Restored' }[
    entry.action
  ];
}

/** The changed fields of an update (none for a create, delete or restore). */
export function changeLines(entry: ApiHistoryEntry, options: DescribeOptions = {}): ChangeLine[] {
  if (entry.action !== 'update') return [];
  const lines: ChangeLine[] = [];
  for (const [field, change] of Object.entries(entry.changes)) {
    if (HIDDEN.has(field) || !Array.isArray(change)) continue;
    const [from, to] = change;
    if (PRICES.has(field)) {
      lines.push(priceLine(field, from, to));
    } else if (field in ATTRIBUTE_FIELDS) {
      const titles = options.titles?.[entry.object.type] ?? {};
      for (const [path, before, after] of changedPaths(asHash(from), asHash(to))) {
        lines.push(valueLine(ATTRIBUTE_FIELDS[field] + pathTitle(path, titles), before, after));
      }
    } else if (MONEY.has(field)) {
      lines.push({ field: FIELD_NAMES[field], from: money(from), to: money(to) });
    } else {
      const names = options.lookups?.[field];
      lines.push(valueLine(FIELD_NAMES[field] ?? humanize(field), from, to, names));
    }
  }
  return lines;
}

function valueLine(
  field: string,
  before: unknown,
  after: unknown,
  names?: Record<string, string>,
): ChangeLine {
  const line = { field, from: show(before, names), to: show(after, names) };
  const long = line.from.length > VALUE_LIMIT || line.to.length > VALUE_LIMIT;
  const structured = isStructured(before) || isStructured(after);
  const multiline = [before, after].some((v) => typeof v === 'string' && v.includes('\n'));
  if (!long || !(structured || multiline)) return line;
  const text = (value: unknown) =>
    value === null || value === undefined
      ? ''
      : structured
        ? JSON.stringify(value, null, 2)
        : typeof value === 'string'
          ? value
          : show(value);
  return { ...line, diff: diffLines(text(before), text(after)) };
}

const isStructured = (value: unknown) => value !== null && typeof value === 'object';

/**
 * `before` and `after` compared line by line: each changed line, with CONTEXT
 * unchanged lines around it, and the unchanged runs between left out.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before ? before.split('\n') : [];
  const b = after ? after.split('\n') : [];
  // Most edits are local: match the common start and end first.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const same = (text: string): DiffLine => ({ kind: 'same', text });
  return collapse([
    ...a.slice(0, start).map(same),
    ...diffMiddle(a.slice(start, endA), b.slice(start, endB)),
    ...a.slice(endA).map(same),
  ]);
}

/** The least-change line diff (by longest common subsequence). */
function diffMiddle(a: string[], b: string[]): DiffLine[] {
  const removed = (text: string): DiffLine => ({ kind: 'removed', text });
  const added = (text: string): DiffLine => ({ kind: 'added', text });
  if (a.length * b.length > MAX_DIFF_CELLS) return [...a.map(removed), ...b.map(added)];
  // common[i * width + j]: the longest common run of a[i:] and b[j:].
  const width = b.length + 1;
  const common = new Uint16Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      common[i * width + j] =
        a[i] === b[j]
          ? common[(i + 1) * width + j + 1] + 1
          : Math.max(common[(i + 1) * width + j], common[i * width + j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i] });
      i++;
      j++;
    } else if (common[(i + 1) * width + j] >= common[i * width + j + 1]) {
      out.push(removed(a[i++]));
    } else {
      out.push(added(b[j++]));
    }
  }
  return [...out, ...a.slice(i).map(removed), ...b.slice(j).map(added)];
}

/** Keep CONTEXT unchanged lines either side of each change; count the rest. */
function collapse(lines: DiffLine[]): DiffLine[] {
  const changed = lines.map((line) => line.kind !== 'same');
  const near = (index: number) =>
    changed.slice(Math.max(0, index - CONTEXT), index + CONTEXT + 1).some(Boolean);
  const out: DiffLine[] = [];
  lines.forEach((line, index) => {
    if (near(index)) {
      out.push(line);
      return;
    }
    const last = out[out.length - 1];
    if (last?.kind === 'skip') last.count++;
    else out.push({ kind: 'skip', count: 1 });
  });
  return out;
}

const money = (value: unknown) =>
  typeof value === 'number' || (typeof value === 'string' && value !== 'None' && value !== '')
    ? formatMoney(value)
    : 'none';

function priceLine(field: string, from: unknown, to: unknown): ChangeLine {
  const name = field === 'client_reported_pricing' ? 'Price shown when registering' : 'Price';
  const before = total(from);
  const after = total(to);
  if (before === after && before !== undefined) {
    return { field: `${name} breakdown`, from: 'changed', to: `total still ${before}` };
  }
  return { field: name, from: before ?? 'none', to: after ?? 'none' };
}

function total(results: unknown): string | undefined {
  const value = (results as Hash | null)?.total;
  return typeof value === 'number' || typeof value === 'string' ? formatMoney(value) : undefined;
}

const asHash = (value: unknown): Hash =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Hash) : {};

/** [path, before, after] for every leaf that differs; arrays compare whole. */
export function changedPaths(from: Hash, to: Hash, prefix = ''): [string, unknown, unknown][] {
  const out: [string, unknown, unknown][] = [];
  for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
    const path = prefix ? `${prefix}.${key}` : key;
    const [a, b] = [from[key], to[key]];
    if (isPlainObject(a) || isPlainObject(b)) {
      out.push(...changedPaths(asHash(a), asHash(b), path));
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      out.push([path, a, b]);
    }
  }
  return out;
}

const isPlainObject = (value: unknown) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function pathTitle(path: string, titles: Record<string, string>): string {
  const parts = path.split('.');
  return parts
    .map((part, index) => titles[parts.slice(0, index + 1).join('.')] ?? humanize(part))
    .join(' › ');
}

/** A value as text: "none" for nothing, Yes/No, lists joined, ids by name. */
export function show(value: unknown, names?: Record<string, string>): string {
  if (value === null || value === undefined || value === '') return 'none';
  if (names && (typeof value === 'string' || typeof value === 'number')) {
    return names[String(value)] ?? `#${value}`;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === 'True' || value === 'False') return value === 'True' ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map((v) => show(v)).join(', ') : 'none';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

export function humanize(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Attribute titles from a JSON schema, by dotted path (`$ref`s to its definitions resolved). */
export function schemaTitles(
  schema: JSONSchema7 | undefined,
  root: JSONSchema7 | undefined = schema,
  prefix = '',
): Record<string, string> {
  const titles: Record<string, string> = {};
  for (const [key, definition] of Object.entries(schema?.properties ?? {})) {
    const property = resolve(definition, root);
    if (!property) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (property.title) titles[path] = property.title;
    if (property.properties) Object.assign(titles, schemaTitles(property, root, path));
  }
  return titles;
}

function resolve(
  definition: JSONSchema7Definition,
  root: JSONSchema7 | undefined,
): JSONSchema7 | undefined {
  if (typeof definition !== 'object') return undefined;
  const ref = definition.$ref?.match(/^#\/definitions\/(.+)$/)?.[1];
  const target = ref ? root?.definitions?.[ref] : undefined;
  return typeof target === 'object' ? { ...target, ...definition } : definition;
}

/**
 * Entries in the order given, grouped by the request that made them — an edit
 * and the pricing it recalculated read as one change.
 */
export function groupByRequest(entries: ApiHistoryEntry[]): ApiHistoryEntry[][] {
  const groups: ApiHistoryEntry[][] = [];
  for (const entry of entries) {
    const last = groups.at(-1);
    if (last && entry.request_id && last[0].request_id === entry.request_id) last.push(entry);
    else groups.push([entry]);
  }
  return groups;
}
