/**
 * The form's validator (SPEC §9.1, DR-34): @rjsf/validator-ajv8 with every
 * validation pass's errors run through `resolveErrorMessages`.
 *
 * Messages are applied here rather than via rjsf's `transformErrors` prop
 * because rjsf validates *before* the parent receives `onChange`: a
 * transformer closing over the `formData` prop would see the previous
 * keystroke's data (so `{{camper}}` names would lag). `validateFormData` is
 * handed the current data.
 *
 * Build one per form and keep it (rjsf rebuilds its schema utilities whenever
 * the validator's identity changes); the context is read on every pass through
 * `getContext`.
 */

import type { RJSFSchema, ValidatorType } from '@rjsf/utils';
import baseValidator from '@rjsf/validator-ajv8';

import { type ErrorMessageContext, resolveErrorMessages } from './errorMessages';

export function createMessagingValidator(
  getContext: () => Omit<ErrorMessageContext, 'formData'>,
  base: ValidatorType<unknown, RJSFSchema> = baseValidator,
): ValidatorType<unknown, RJSFSchema> {
  // Share the base instance's Ajv (and its compiled-schema cache).
  const validator = Object.create(base) as ValidatorType<unknown, RJSFSchema>;
  validator.validateFormData = (formData, schema, customValidate, transformErrors, uiSchema) =>
    base.validateFormData(
      formData,
      schema,
      customValidate,
      (errors, errorsUiSchema) => {
        const context = getContext();
        const resolved = resolveErrorMessages(errors, {
          ...context,
          uiSchema: context.uiSchema ?? errorsUiSchema ?? uiSchema,
          formData,
        });
        return transformErrors ? transformErrors(resolved, errorsUiSchema) : resolved;
      },
      uiSchema,
    );
  return validator;
}
