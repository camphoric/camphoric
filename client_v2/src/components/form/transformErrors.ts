/**
 * Friendlier validation messages (SPEC §7.1, §9.1). rjsf/ajv's default messages
 * are terse ("must match format \"email\""); rewrite the common ones into plain
 * language. Unmatched errors pass through unchanged.
 */

import type { ErrorTransformer, RJSFValidationError } from '@rjsf/utils';

export const transformErrors: ErrorTransformer = (errors) =>
  errors.map((error): RJSFValidationError => {
    const params = (error.params ?? {}) as { format?: string; type?: string };
    switch (error.name) {
      case 'required':
        return { ...error, message: 'This field is required' };
      case 'format':
        return params.format === 'email'
          ? { ...error, message: 'Please enter a valid email address' }
          : error;
      case 'type':
        return params.type === 'number' || params.type === 'integer'
          ? { ...error, message: 'Please enter a number' }
          : error;
      default:
        return error;
    }
  });
