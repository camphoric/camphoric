/**
 * The JSON Schema Form wrapper — the backbone of both surfaces (SPEC §9.1).
 * Wraps the official @rjsf/mantine theme (DR-4) with:
 *   - ajv8 validation, with plain-language messages — the event's own
 *     (`errorMessages`) where it has them, else the built-in defaults — in both
 *     the inline errors and the list at the top (DR-34);
 *   - a `templateData` context so descriptions render templated help text;
 *   - live validation that switches on after the first failed submit (or from
 *     the start, with `liveValidate`);
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
import type { RegistrationErrorMessages } from 'api-types';
import { type TemplateData, TemplateDataProvider } from 'components/form/context';
import type { ErrorMessageContext } from 'components/form/errorMessages';
import { customFields } from 'components/form/fields';
import { createMessagingValidator } from 'components/form/messagingValidator';
import { DescriptionFieldTemplate } from 'components/form/templates/DescriptionFieldTemplate';
import { ErrorListTemplate } from 'components/form/templates/ErrorListTemplate';
import { customWidgets } from 'components/form/widgets';
import { type ReactNode, useLayoutEffect, useMemo, useRef, useState } from 'react';

/** How this form looks up validation messages (§7.1, DR-34). */
export interface ErrorMessagesOptions {
  /** The event's `registration_error_messages`. */
  rules?: RegistrationErrorMessages;
  /** Prefix for rule paths when the form renders part of the registration (`campers.*`). */
  pathPrefix?: string;
  /** The camper a single-camper form edits, for `{{camper}}`. */
  camper?: { label?: string };
}

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
  /** Custom validation messages; without them the built-in defaults apply. */
  errorMessages?: ErrorMessagesOptions;
  /** Validate on every change from the start (admin forms), not only after a failed submit. */
  liveValidate?: boolean;
}

const baseTemplates: Partial<TemplatesType> = { DescriptionFieldTemplate, ErrorListTemplate };

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
  errorMessages,
  liveValidate: liveFromStart = false,
}: JsonSchemaFormProps) {
  // Validate lazily until the registrant first tries to submit, then live —
  // matches the reference behavior (SPEC §7.1).
  const [liveValidate, setLiveValidate] = useState(liveFromStart);

  // One validator per form (a new one would make rjsf rebuild its schema
  // utilities); it reads the latest messages/schema through the ref.
  const messageContext = useRef<Omit<ErrorMessageContext, 'formData'>>({});
  useLayoutEffect(() => {
    messageContext.current = { ...errorMessages, schema, uiSchema };
  });
  const validator = useMemo(() => createMessagingValidator(() => messageContext.current), []);

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
