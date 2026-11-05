/**
 * The event import schema's checks of group emails and promo codes: what the
 * server would refuse fails before any request is made.
 */

import { describe, expect, test } from '@jest/globals';

import { validateEventImport } from '../index.ts';

const withParts = (parts: Record<string, unknown>) => ({
  organization: 'Test',
  event: { name: 'Test' },
  reports: [],
  registration_types: [],
  ...parts,
});

const email = (more: Record<string, unknown> = {}) => ({ name: 'Hello', subject: 'Hi', body: 'Hello', ...more });
const rules = (...list: unknown[]) => ({ filter: { combinator: 'and', rules: list } });
const promo = (more: Record<string, unknown> = {}) => ({ label: 'Early', code: 'EARLY', pricing_logic: 10, ...more });

const valid = (parts: Record<string, unknown>) => validateEventImport(withParts(parts)).length === 0;

describe('email_templates', () => {
  test('accepts a group email with only a name, subject and body', () => {
    expect(valid({ email_templates: [email()] })).toBe(true);
  });

  test('needs a name', () => {
    expect(valid({ email_templates: [email({ name: '' })] })).toBe(false);
  });

  test('takes no sending account (it belongs to the organization)', () => {
    expect(valid({ email_templates: [email({ account: 1 })] })).toBe(false);
  });

  test('takes only the server\'s recipient sources', () => {
    expect(valid({ email_templates: [email({ recipient_source: 'campers' })] })).toBe(true);
    expect(valid({ email_templates: [email({ recipient_source: 'everyone' })] })).toBe(false);
  });

  test('a rule has a value, unless its operator takes none', () => {
    const balance = { field: 'registration.balance', op: 'gt' };
    expect(valid({ email_templates: [email(rules({ ...balance, value: 0 }))] })).toBe(true);
    expect(valid({ email_templates: [email(rules(balance))] })).toBe(false);
    expect(valid({ email_templates: [email(rules({ ...balance, value: '' }))] })).toBe(false);
    expect(valid({ email_templates: [email(rules({ ...balance, value: [] }))] })).toBe(false);
    expect(valid({ email_templates: [email(rules({ field: 'camper.attributes.t_shirt.wanted', op: 'is_true' }))] }))
      .toBe(true);
  });

  test('a rule names a field and a known operator', () => {
    expect(valid({ email_templates: [email(rules({ field: '', op: 'is_set' }))] })).toBe(false);
    expect(valid({ email_templates: [email(rules({ field: 'x', op: 'like', value: 'a' }))] })).toBe(false);
  });
});

describe('promo_codes', () => {
  test('accepts a code with a label and its pricing logic', () => {
    expect(valid({ promo_codes: [promo()] })).toBe(true);
  });

  test('needs a label and a code that is more than spaces', () => {
    expect(valid({ promo_codes: [promo({ label: '' })] })).toBe(false);
    expect(valid({ promo_codes: [promo({ code: '  ' })] })).toBe(false);
  });

  test('takes only the server\'s scopes, and an expiry with an offset', () => {
    expect(valid({ promo_codes: [promo({ scope: 'camper', expiration_date: '2030-05-01T00:00:00-07:00' })] }))
      .toBe(true);
    expect(valid({ promo_codes: [promo({ scope: 'household' })] })).toBe(false);
    expect(valid({ promo_codes: [promo({ expiration_date: 'May 1' })] })).toBe(false);
  });
});
