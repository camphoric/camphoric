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
  | { kind: 'same' | 'removed' | 'added'; text: string }
  | { kind: 'skip'; count: number }
  /** Where in a JSON value the section that follows is: "tuition › exp › if". */
  | { kind: 'where'; path: string };

/** A diff line before collapsing, with its index in its side's lines. */
type Marked = { kind: 'same' | 'removed' | 'added'; text: string; at: number };

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
  invoice: 'Invoice',
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
  completed_at: 'Finished registering at',
  confirmation_sent_at: 'Confirmation sent',
  // Older entries: the first payment was on the registration then (§15, DR-92).
  initial_payment: 'Initial payment',
  invoice: 'Invoice',
  description: 'Description',
  handling: 'Electronic payment handling',
  origin: 'Made by',
  due_on: 'Due on',
  memo: 'Memo',
  cancelled_at: 'Cancelled',
  cancel_reason: 'Cancel reason',
  pending_paypal_order_id: 'Pending PayPal order',
  organizer_changed_at: 'Changed by organizers',
  paypal_transaction_id: 'PayPal transaction',
  refund_of: 'Refund of payment',
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
const MONEY = new Set(['amount', 'handling']);
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
  if (structured) {
    const [a, b] = [prettyLines(before), prettyLines(after)];
    const text = (lines: PrettyLine[]) => lines.map((l) => l.text).join('\n');
    const paths = { before: a.map((l) => l.path), after: b.map((l) => l.path) };
    return { ...line, diff: diffLines(text(a), text(b), paths) };
  }
  const text = (value: unknown) =>
    value === null || value === undefined ? '' : typeof value === 'string' ? value : show(value);
  return { ...line, diff: diffLines(text(before), text(after)) };
}

interface PrettyLine {
  text: string;
  /** Where the line is in the value: "tuition › exp › if" ('' at the top). */
  path: string;
}

// Fields that name a list item (a pricing line by its `var`).
const ITEM_NAMES = ['var', 'name', 'label', 'title', 'key', 'id'];

/** A list item by what it's called when it says (an object with fields), else its position. */
function itemName(item: unknown, index: number): string {
  if (isPlainObject(item) && Object.keys(item as Hash).length > 1) {
    for (const key of ITEM_NAMES) {
      const value = (item as Hash)[key];
      if (typeof value === 'string' || typeof value === 'number') return String(value);
    }
  }
  return `item ${index + 1}`;
}

/**
 * A value as `JSON.stringify(value, null, 2)` writes it, line by line, each
 * line with the path to where it is in the value.
 */
export function prettyLines(value: unknown): PrettyLine[] {
  const out: PrettyLine[] = [];
  const walk = (v: unknown, indent: string, prefix: string, path: string[], last: boolean) => {
    const comma = last ? '' : ',';
    const at = path.join(' › ');
    const nested = (open: string, close: string, children: [string, unknown, string][]) => {
      if (!children.length) {
        out.push({ text: `${indent}${prefix}${open}${close}${comma}`, path: at });
        return;
      }
      out.push({ text: `${indent}${prefix}${open}`, path: at });
      children.forEach(([key, child, name], i) =>
        walk(child, `${indent}  `, key, [...path, name], i === children.length - 1),
      );
      out.push({ text: `${indent}${close}${comma}`, path: at });
    };
    if (Array.isArray(v)) {
      nested(
        '[',
        ']',
        v.map((item, i) => ['', item === undefined ? null : item, itemName(item, i)]),
      );
    } else if (isPlainObject(v)) {
      nested(
        '{',
        '}',
        Object.entries(v as Hash)
          .filter(([, child]) => child !== undefined)
          .map(([key, child]) => [`${JSON.stringify(key)}: `, child, key]),
      );
    } else {
      out.push({ text: `${indent}${prefix}${JSON.stringify(v) ?? 'null'}${comma}`, path: at });
    }
  };
  if (value !== null && value !== undefined) walk(value, '', '', [], true);
  return out;
}

const isStructured = (value: unknown) => value !== null && typeof value === 'object';

/**
 * `before` and `after` compared line by line: each changed line, with CONTEXT
 * unchanged lines around it, and the unchanged runs between left out. Given
 * each line's path in a JSON value, each section is headed with where its
 * first change is.
 */
export function diffLines(
  before: string,
  after: string,
  paths?: { before: string[]; after: string[] },
): DiffLine[] {
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
  const same =
    (offset: number) =>
    (text: string, i: number): Marked => ({
      kind: 'same',
      text,
      at: offset + i,
    });
  const middle = diffMiddle(a.slice(start, endA), b.slice(start, endB)).map((line) => ({
    ...line,
    at: line.at + start,
  }));
  return collapse(
    [...a.slice(0, start).map(same(0)), ...middle, ...a.slice(endA).map(same(endA))],
    paths,
  );
}

/** The least-change line diff (by longest common subsequence). */
function diffMiddle(a: string[], b: string[]): Marked[] {
  const removed = (text: string, at: number): Marked => ({ kind: 'removed', text, at });
  const added = (text: string, at: number): Marked => ({ kind: 'added', text, at });
  const rest = (i: number, j: number) => [
    ...a.slice(i).map((text, k) => removed(text, i + k)),
    ...b.slice(j).map((text, k) => added(text, j + k)),
  ];
  if (a.length * b.length > MAX_DIFF_CELLS) return rest(0, 0);
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
  const out: Marked[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i], at: i });
      i++;
      j++;
    } else if (common[(i + 1) * width + j] >= common[i * width + j + 1]) {
      out.push(removed(a[i], i));
      i++;
    } else {
      out.push(added(b[j], j));
      j++;
    }
  }
  return [...out, ...rest(i, j)];
}

/**
 * Keep CONTEXT unchanged lines either side of each change; count the rest.
 * Given paths, head each kept section with where its first change is.
 */
function collapse(lines: Marked[], paths?: { before: string[]; after: string[] }): DiffLine[] {
  const changed = lines.map((line) => line.kind !== 'same');
  const near = (index: number) =>
    changed.slice(Math.max(0, index - CONTEXT), index + CONTEXT + 1).some(Boolean);
  const where = (index: number) => {
    const first = lines[changed.indexOf(true, index)];
    if (!paths || !first) return '';
    return (first.kind === 'added' ? paths.after : paths.before)[first.at] ?? '';
  };
  const out: DiffLine[] = [];
  lines.forEach(({ kind, text }, index) => {
    if (near(index)) {
      const starting = !out.length || out[out.length - 1].kind === 'skip';
      const path = starting ? where(index) : '';
      if (path) out.push({ kind: 'where', path });
      out.push({ kind, text });
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
