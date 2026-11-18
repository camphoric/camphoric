/**
 * rjsf's ajv8 validator with the `email` format checked by the same rule as
 * the server (SPEC §7.1, DR-166), shared by every form.
 */

import { customizeValidator } from '@rjsf/validator-ajv8';

import { isEmailAddress } from './emailAddress';

export const formValidator = customizeValidator({ customFormats: { email: isEmailAddress } });
