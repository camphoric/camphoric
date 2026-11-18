import type { RJSFSchema } from '@rjsf/utils';
import { describe, expect, it } from 'vitest';

import { isEmailAddress } from '../emailAddress';
import { createMessagingValidator } from '../messagingValidator';
import { reviewItems } from '../reviewItems';

// The same cases as server/tests/test_email_address.py and
// data/packages/event-import-spec/__tests__/formSchema.test.ts: all three
// apply one rule (SPEC DR-166), so keep them in step.
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
  // Django refuses these; ajv alone would take them.
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
  it.each(VALID)('accepts %j', (email) => {
    expect(isEmailAddress(email)).toBe(true);
  });

  it.each(INVALID)('refuses %j', (email) => {
    expect(isEmailAddress(email)).toBe(false);
  });
});

describe("the form's email format", () => {
  // The registrant email as the server serves it: no pattern of its own.
  const schema: RJSFSchema = {
    type: 'object',
    required: ['registrant_email'],
    properties: {
      registrant_email: { type: 'string', format: 'email', maxLength: 254 },
    },
  };
  const validator = createMessagingValidator(() => ({ schema }));
  const errors = (registrant_email: string) =>
    validator.validateFormData({ registrant_email }, schema).errors;

  it.each(['jane-doe@my-camp.org', 'jane+camp@example.com', "o'brien@example.com",
    'jane@example.photography'])('accepts %j', (email) => {
    expect(errors(email)).toEqual([]);
  });

  it.each(['jane', 'jane@', '@example.com', 'jane doe@example.com', 'jane@gmail.c'])(
    'refuses %j with the email message',
    (email) => {
      expect(errors(email)).toEqual([
        expect.objectContaining({
          name: 'format',
          property: '.registrant_email',
          message: 'Please enter a valid email address',
        }),
      ]);
    },
  );

  it('is the one the review resolves conditional fields with', () => {
    // A branch chosen by whether the email passes: the review shows the
    // field the form shows.
    const conditional: RJSFSchema = {
      type: 'object',
      properties: { email: { type: 'string', title: 'Email' } },
      if: { properties: { email: { format: 'email' } } },
      then: { properties: { ok: { type: 'string', title: 'Valid' } } },
      else: { properties: { ok: { type: 'string', title: 'Invalid' } } },
    };
    const label = (email: string) =>
      reviewItems(conditional, {}, { email, ok: 'yes' }, conditional)
        .find((item) => item.text === 'yes')?.label;
    expect(label("o'brien@example.com")).toBe('Valid');
    expect(label('jane@gmail.c')).toBe('Invalid');
  });
});
