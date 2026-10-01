/**
 * Turning audit entries (SPEC §5; §15, DR-53) into words: what happened to what,
 * and each changed field as "Title: old → new". JSON fields (attributes, stay,
 * …) are compared key by key, so only what changed is shown; a price shows as
 * its total before and after.
 */

import type { ApiHistoryEntry, Hash } from 'api-types';
import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { formatMoney } from 'utils/money';

export interface ChangeLine {
  field: string;
  from: string;
  to: string;
}

export interface DescribeOptions {
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
};

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

/** "Camper “Pat Alpha”", or just "Registration" for the registration itself. */
export function objectName(entry: ApiHistoryEntry): string {
  const type = TYPE_NAMES[entry.object.type] ?? humanize(entry.object.type);
  return entry.object.type === 'registration' ? type : `${type} “${entry.object.label}”`;
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
        lines.push({
          field: ATTRIBUTE_FIELDS[field] + pathTitle(path, titles),
          from: show(before),
          to: show(after),
        });
      }
    } else if (MONEY.has(field)) {
      lines.push({ field: FIELD_NAMES[field], from: money(from), to: money(to) });
    } else {
      const names = options.lookups?.[field];
      lines.push({
        field: FIELD_NAMES[field] ?? humanize(field),
        from: show(from, names),
        to: show(to, names),
      });
    }
  }
  return lines;
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
