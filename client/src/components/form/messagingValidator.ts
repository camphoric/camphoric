/**
 * The form's validator (SPEC §9.1, DR-34): @rjsf/validator-ajv8 (with the
 * form's email rule, DR-166), plus the phone-number rule for the fields the
 * phone widget answers (DR-174), with every validation pass's errors run
 * through `resolveErrorMessages`.
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

import { type ErrorMessageContext, resolveErrorMessages } from './errorMessages';
import { formValidator } from './formValidator';
import { phoneNumberErrors } from './phoneNumber';

export function createMessagingValidator(
  getContext: () => Omit<ErrorMessageContext, 'formData'>,
  base: ValidatorType<unknown, RJSFSchema> = formValidator,
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
        const formUiSchema = context.uiSchema ?? errorsUiSchema ?? uiSchema;
        const phoneErrors = phoneNumberErrors(base, schema, formUiSchema, formData);
        const resolved = resolveErrorMessages([...errors, ...phoneErrors], {
          ...context,
          uiSchema: formUiSchema,
          formData,
        });
        return transformErrors ? transformErrors(resolved, errorsUiSchema) : resolved;
      },
      uiSchema,
    );
  return validator;
}
