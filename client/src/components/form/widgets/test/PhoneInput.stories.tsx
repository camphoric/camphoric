/**
 * Stories for the phone widget (SPEC §9.1, DR-175). It saves numbers in E.164
 * form. A number without a `+` is a number in the selected country, read by
 * that country's rules — so browser autofill and paste, which often give a
 * national number (`(202) 555-1234`), keep the country — and one with `+` and
 * another country code switches the country. The country starts as the field's
 * `ui:options.defaultCountry`, else the US. A dial code alone is no answer, so
 * a required one is rejected as missing (#986), and a number cut short
 * (`(707)`) is rejected as not a whole number for its country (#1034, DR-174).
 * Also a render target for the Playwright e2e suite.
 */

import { Code, Stack, Title } from '@mantine/core';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { JsonSchemaForm } from 'components/form';
import { useState } from 'react';

const schema: RJSFSchema = {
  type: 'object',
  properties: {
    phone: { type: 'string', title: 'Phone', description: 'We’ll call if plans change.' },
  },
};

export default { title: 'Phone Input' } satisfies Meta;

const PhoneForm = ({
  initial = {},
  required = false,
  options,
}: {
  initial?: { phone?: string };
  required?: boolean;
  /** The widget's `ui:options` (`defaultCountry`). */
  options?: Record<string, unknown>;
}) => {
  const [formData, setFormData] = useState<unknown>(initial);
  const uiSchema: UiSchema = {
    phone: { 'ui:widget': 'PhoneInput', ...(options && { 'ui:options': options }) },
  };
  return (
    <Stack maw={420} p="md">
      <JsonSchemaForm
        schema={required ? { ...schema, required: ['phone'] } : schema}
        uiSchema={uiSchema}
        formData={formData}
        onChange={setFormData}
      />
      <Title order={6}>Live form data</Title>
      <Code block data-testid="form-data">
        {JSON.stringify(formData, null, 2)}
      </Code>
    </Stack>
  );
};

/** A new, empty field: US, ready for a number (try autofill or paste). */
export const Empty: StoryFn = () => <PhoneForm />;

/** A saved number from another country shows in that country, with its flag. */
export const International: StoryFn = () => <PhoneForm initial={{ phone: '+442079460958' }} />;

/** A field that starts in the UK: `020 7946 0958` saves as `+442079460958`. */
export const UnitedKingdom: StoryFn = () => <PhoneForm options={{ defaultCountry: 'GB' }} />;

/** A required number: submitting with a dial code alone (`+44`) says it's required. */
export const Required: StoryFn = () => <PhoneForm required />;

/**
 * A number cut short (an area code alone): submitting asks for the whole
 * number. Finishing it (`3975275`) clears the error.
 */
export const CutShort: StoryFn = () => <PhoneForm initial={{ phone: '+1707' }} required />;
