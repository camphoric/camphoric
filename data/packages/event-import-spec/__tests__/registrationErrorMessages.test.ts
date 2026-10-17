/**
 * The event import schema's checks of registration_error_messages.
 */

import { describe, expect, test } from '@jest/globals';

import { validateEventImport } from '../index.ts';

// registration_error_messages is optional, but when present it must be
// { path: { keyword: message } } with non-empty strings — a malformed table
// fails the import before any request is made.
describe('registration_error_messages', () => {
  const withMessages = (registration_error_messages: unknown) => ({
    organization: 'Test',
    event: { name: 'Test', registration_error_messages },
    reports: [],
    registration_types: [],
  });

  test('accepts a path → keyword → message table', () => {
    expect(validateEventImport(withMessages({
      'campers.*.phone': { pattern: '{{camper}}: enter a phone number' },
      '*': { required: '{{field}} is required' },
    }))).toEqual([]);
  });

  test.each([
    ['a list', ['nope']],
    ['a path mapped to a string', { 'campers.*.phone': 'nope' }],
    ['a non-string message', { 'campers.*.phone': { pattern: 42 } }],
    ['an empty message', { 'campers.*.phone': { pattern: '' } }],
    ['an empty path', { '': { required: 'x' } }],
    ['an empty keyword', { 'campers.*.phone': { '': 'x' } }],
  ])('rejects %s', (_label, value) => {
    expect(validateEventImport(withMessages(value))).not.toEqual([]);
  });
});
