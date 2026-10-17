/**
 * Sample Camp is meant to use as much of the import contract as it can, so
 * it tests importing every feature. The contract's schema drives these
 * checks, so a field added to it fails here until Sample Camp uses it.
 */

import { describe, expect, test } from '@jest/globals';
import {
  EventImportSchema,
  LodgingNodeSchema,
  type OrganizationImport,
} from '@camphoric/camphoric-event-import-spec';

import sampleCamp from '../index.ts';

const { data, organization } = sampleCamp;

// Only set where the environment configures them (index.ts)
const SET_BY_ENVIRONMENT = ['paypal_enabled', 'paypal_client_id'];

// Handlebars reports are retired
const RETIRED_OUTPUTS = ['hbs'];

type Properties = Record<string, { anyOf?: { const?: string }[] }>;

const properties = (schema: unknown): Properties => (schema as { properties: Properties }).properties;
const itemProperties = (schema: unknown): Properties => properties((schema as { items: unknown }).items);

// The names no item of `items` sets
const unsetBy = (items: object[], names: string[]) => names
  .filter(name => !items.some(item => (item as Record<string, unknown>)[name] !== undefined));

describe('Sample Camp covers the import contract', () => {
  const contract = properties(EventImportSchema);

  test('every event field', () => {
    const fields = Object.keys(properties(contract.event))
      .filter(field => !SET_BY_ENVIRONMENT.includes(field));
    expect(unsetBy([data.event], fields)).toEqual([]);
  });

  test('every top-level part of the import object', () => {
    expect(unsetBy([data], Object.keys(contract))).toEqual([]);
  });

  test.each(['reports', 'registration_types', 'custom_charge_types'] as const)(
    'every field of %s, on at least one of them',
    (part) => {
      expect(unsetBy(data[part] ?? [], Object.keys(itemProperties(contract[part])))).toEqual([]);
    },
  );

  test('every lodging field, on at least one node', () => {
    expect(unsetBy(Object.values(data.lodgings ?? {}), Object.keys(properties(LodgingNodeSchema)))).toEqual([]);
  });

  test('every report output and variable source', () => {
    const report = itemProperties(contract.reports);
    for (const field of ['output', 'variables_source']) {
      const values = (report[field].anyOf ?? []).map(option => option.const as string)
        .filter(value => !RETIRED_OUTPUTS.includes(value));
      const used = new Set(data.reports.map(r => (r as Record<string, unknown>)[field]));
      expect({ field, unused: values.filter(value => !used.has(value)) }).toEqual({ field, unused: [] });
    }
  });

  test('every email account field of its organization', () => {
    const fields: (keyof OrganizationImport['emailAccount'])[] = ['name', 'backend', 'host', 'port', 'username', 'password'];
    expect(unsetBy([organization.emailAccount], fields)).toEqual([]);
  });

  test('a payment option in a sample registration', async () => {
    const lodging = new Proxy({}, { get: (_, key) => ({ id: 1, name: String(key) }) });
    const regs = await sampleCamp.sampleRegGenerator({} as never, { event: { id: 1 }, lodging } as never, () => {});
    expect(regs.some(reg => reg.paymentData?.paymentOption)).toBe(true);
  });
});
