/**
 * The JSON Schema Form wrapper — the backbone of both surfaces (SPEC §9.1).
 * Wraps the official @rjsf/mantine theme (DR-4) with:
 *   - ajv8 validation;
 *   - a `templateData` context so descriptions render templated help text;
 *   - friendlier error messages (transformErrors);
 *   - live validation that switches on after the first failed submit;
 *   - the custom templated Description renderer.
 *
 * Custom fields/widgets (Campers, Address, LodgingRequested, phone/number/etc.)
 * register through the same `fields`/`widgets` props and land in later parts of
 * this phase.
 */

import { Form } from '@rjsf/mantine';
import type {
  RegistryFieldsType,
  RegistryWidgetsType,
  RJSFSchema,
  TemplatesType,
  UiSchema,
} from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { type TemplateData, TemplateDataProvider } from 'components/form/context';
import { customFields } from 'components/form/fields';
import { DescriptionFieldTemplate } from 'components/form/templates/DescriptionFieldTemplate';
import { transformErrors } from 'components/form/transformErrors';
import { customWidgets } from 'components/form/widgets';
import { type ReactNode, useState } from 'react';

export interface JsonSchemaFormProps {
  schema: RJSFSchema;
  uiSchema?: UiSchema;
  formData?: unknown;
  /** Exposed to descriptions for templated help text (§9.1). */
  templateData?: TemplateData;
  fields?: RegistryFieldsType;
  widgets?: RegistryWidgetsType;
  disabled?: boolean;
  /** Children replace the default submit button (the caller supplies controls). */
  children?: ReactNode;
  onChange?: (formData: unknown, id?: string) => void;
  onSubmit?: (formData: unknown) => void;
  onError?: (errors: unknown[]) => void;
}

const baseTemplates: Partial<TemplatesType> = { DescriptionFieldTemplate };

export function JsonSchemaForm({
  schema,
  uiSchema,
  formData,
  templateData = {},
  fields,
  widgets,
  disabled,
  children,
  onChange,
  onSubmit,
  onError,
}: JsonSchemaFormProps) {
  // Validate lazily until the registrant first tries to submit, then live —
  // matches the reference behavior (SPEC §7.1).
  const [liveValidate, setLiveValidate] = useState(false);

  return (
    <TemplateDataProvider value={templateData}>
      <Form
        schema={schema}
        uiSchema={uiSchema}
        formData={formData}
        validator={validator}
        templates={baseTemplates}
        // Caller-supplied fields/widgets win over the custom defaults.
        fields={{ ...customFields, ...fields }}
        widgets={{ ...customWidgets, ...widgets }}
        transformErrors={transformErrors}
        liveValidate={liveValidate}
        showErrorList="top"
        disabled={disabled}
        onChange={({ formData: next }, id) => onChange?.(next, id)}
        onSubmit={({ formData: next }) => onSubmit?.(next)}
        onError={(errors) => {
          setLiveValidate(true);
          onError?.(errors);
        }}
      >
        {children}
      </Form>
    </TemplateDataProvider>
  );
}
