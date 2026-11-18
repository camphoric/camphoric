/**
 * The form schema and email rule the conformance check holds sample
 * registrations to: what the server would refuse when the importer registers
 * them fails here first.
 */

import { describe, expect, test } from '@jest/globals';
import { Ajv2019 } from 'ajv/dist/2019.js';

import { addFormFormats, formSchema, isEmailAddress } from '../formSchema.ts';
import type { EventData } from '../index.ts';

// The cases of client/src/components/form/test/emailAddress.test.ts and
// server/tests/test_email_address.py: the three apply one rule (SPEC DR-166),
// so keep them in step.
const VALID = [
  'jane-doe@my-camp.org',
  'jane+camp@example.com',
  "o'brien@example.com",
  'jane@example.photography',
  'jane@example.museum',
  'a=b@example.com',
  "!#$%&'*+/=?^_`{|}~-@example.com",
  'jane.doe@example.co.uk',
  'JANE@EXAMPLE.COM',
  'jane@123.example.com',
  'jane@xn--exmple-cua.com',
  'jane@example.xn--p1ai',
  `jane@${'a'.repeat(63)}.com`,
];

const INVALID = [
  '',
  'jane',
  'jane@',
  '@example.com',
  'jane doe@example.com',
  'jane@exa mple.com',
  ' jane@example.com',
  'jane@example.com ',
  'jane@example.com\n',
  'jane@@example.com',
  'jane..doe@example.com',
  '.jane@example.com',
  'jane.@example.com',
  'jane@example..com',
  'jane@.example.com',
  'jane@example.com.',
  'jane@-example.com',
  'jane@example-.com',
  'jane@example_x.com',
  // The server refuses these; ajv's format alone would take them.
  'jane@gmail.c',
  'jane@example.123',
  `jane@${'a'.repeat(64)}.com`,
  `jane@example.${'a'.repeat(64)}`,
  `${'j'.repeat(310)}@example.com`,
  // ajv refuses these; Django alone would take them.
  'jane@localhost',
  'jane@[127.0.0.1]',
  '"jane"@example.com',
  'jane@exämple.com',
  'jöhn@example.com',
  'jaſe@example.com', // ſ, which Django's case-insensitive match lets in
];

describe('isEmailAddress', () => {
  test.each(VALID)('accepts %j', (email) => {
    expect(isEmailAddress(email)).toBe(true);
  });

  test.each(INVALID)('refuses %j', (email) => {
    expect(isEmailAddress(email)).toBe(false);
  });
});

describe('the form schema, with the form formats', () => {
  const event = {
    name: 'Test',
    registration_schema: { type: 'object', properties: { contact: { type: 'string', format: 'email' } } },
    camper_schema: { type: 'object', properties: {} },
  } as unknown as EventData;
  const validate = addFormFormats(new Ajv2019({ strict: false, allowUnionTypes: true }))
    .compile(formSchema(event));
  const valid = (formData: Record<string, unknown>) => validate({ campers: [{}], ...formData });

  test.each(['alex@example.com', "o'brien@example.photography"])('accepts registrant_email %j', (email) => {
    expect(valid({ registrant_email: email })).toBe(true);
  });

  test.each(['alex@example.c', 'alex@example.123', `alex@${'a'.repeat(64)}.com`])(
    'refuses registrant_email %j',
    (email) => {
      expect(valid({ registrant_email: email })).toBe(false);
    },
  );

  test('keeps registrant_email within the 254 characters the server stores', () => {
    const at254 = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(57)}.com`;
    expect(at254).toHaveLength(254);
    expect(valid({ registrant_email: at254 })).toBe(true);
    expect(valid({ registrant_email: `a${at254}` })).toBe(false);
  });

  test('takes from 1 to 20 campers, as the server does', () => {
    const campers = (count: number) => Array.from({ length: count }, () => ({}));
    const email = 'alex@example.com';
    expect(valid({ registrant_email: email, campers: campers(0) })).toBe(false);
    expect(valid({ registrant_email: email, campers: campers(20) })).toBe(true);
    expect(valid({ registrant_email: email, campers: campers(21) })).toBe(false);
  });

  test("checks the event's own email fields by the same rule", () => {
    expect(valid({ registrant_email: 'alex@example.com', contact: 'sam@example.org' })).toBe(true);
    expect(valid({ registrant_email: 'alex@example.com', contact: 'sam@example.o' })).toBe(false);
  });
});
