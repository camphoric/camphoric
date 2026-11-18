/**
 * The email-address rule the forms apply (SPEC §7.1, DR-166): an address is
 * valid when both ajv's `email` format and Django's `validate_email` (which
 * the server checks the registration with) accept it, so an address the form
 * takes is never refused when it's submitted. The server's check
 * (`server/camphoric/email_address.py`) is the same rule from the other side.
 *
 * ajv's format takes some addresses Django's refuses, which are left out
 * here: a top-level domain that isn't two or more letters (`jane@gmail.c`,
 * `jane@example.123`) unless it's punycode (`xn--p1ai`), a domain label over
 * 63 characters, and an address over 320 characters.
 */

import { fullFormats } from 'ajv-formats/dist/formats';

// ajv-formats' "full" email format, which rjsf's validator uses.
const AJV_EMAIL = fullFormats.email as RegExp;

// Django's top-level domain: letters with inner hyphens, or a punycode label.
const TOP_LEVEL_DOMAIN = /^(?:[a-z][a-z-]{0,61}[a-z]|xn--[a-z0-9]{1,59})$/i;

const MAX_LABEL = 63;
const MAX_ADDRESS = 320;

export function isEmailAddress(value: string): boolean {
  if (value.length > MAX_ADDRESS || !AJV_EMAIL.test(value)) return false;
  // ajv's format guarantees one `@` and a dotted domain.
  const labels = value.slice(value.indexOf('@') + 1).split('.');
  return labels.every((label) => label.length <= MAX_LABEL)
    && TOP_LEVEL_DOMAIN.test(labels[labels.length - 1]);
}
