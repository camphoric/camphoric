/**
 * The registration form's schema and formats as the server serves and checks
 * them, for the conformance check of an event's sample registrations. Not part
 * of the package's exports.
 */

import type { Ajv } from 'ajv';
import { fullFormats } from 'ajv-formats/dist/formats.js';

import { addFormats, type EventData } from './index.ts';

// The parts of an object's JSON Schema that the form schema builds on
export interface ObjectSchema {
  definitions?: Record<string, unknown>;
  properties?: Record<string, unknown>;
  required?: string[];
  [keyword: string]: unknown;
}

/**
 * The registration form's schema as the server builds it (get_form_schema in
 * server/camphoric/views.py): the camper schema as a definition, the campers
 * list and registrant_email added. The server supplies the lodging field, so
 * any value passes here.
 */
export function formSchema(event: EventData) {
  const registration_schema: ObjectSchema = event.registration_schema ?? {};
  const camper_schema: ObjectSchema = event.camper_schema ?? {};

  return {
    ...registration_schema,
    definitions: {
      ...(registration_schema.definitions ?? {}),
      camper: {
        ...camper_schema,
        properties: { ...(camper_schema.properties ?? {}), lodging: {} },
      },
    },
    required: [...(registration_schema.required ?? []), 'registrant_email'],
    properties: {
      registrant_email: { type: 'string', format: 'email', maxLength: 254 },
      ...(registration_schema.properties ?? {}),
      campers: { type: 'array', minItems: 1, items: { $ref: '#/definitions/camper' } },
    },
  };
}

// ajv-formats' "full" email format, which the client's form uses.
const AJV_EMAIL = fullFormats.email as RegExp;

// Django's top-level domain: letters with inner hyphens, or a punycode label.
const TOP_LEVEL_DOMAIN = /^(?:[a-z][a-z-]{0,61}[a-z]|xn--[a-z0-9]{1,59})$/i;

const MAX_LABEL = 63;
const MAX_ADDRESS = 320;

/**
 * The email-address rule the server and the client's form apply (SPEC §7.1,
 * DR-166; `isEmailAddress` in client/src/components/form/emailAddress.ts and
 * server/camphoric/email_address.py): an address both ajv's `email` format
 * and Django's `validate_email` accept. ajv's format alone takes a top-level
 * domain that isn't two or more letters (`jane@gmail.c`, `jane@example.123`)
 * unless it's punycode, a domain label over 63 characters, and an address
 * over 320 characters, which the server refuses.
 */
export function isEmailAddress(value: string): boolean {
  if (value.length > MAX_ADDRESS || !AJV_EMAIL.test(value)) return false;
  // ajv's format guarantees one `@` and a dotted domain.
  const labels = value.slice(value.indexOf('@') + 1).split('.');
  return labels.every((label) => label.length <= MAX_LABEL)
    && TOP_LEVEL_DOMAIN.test(labels[labels.length - 1]);
}

/** Add ajv-formats' formats to `ajv`, with `email` checked by the form's rule. */
export function addFormFormats<T extends Ajv>(ajv: T): T {
  addFormats(ajv);
  ajv.addFormat('email', isEmailAddress);
  return ajv;
}
