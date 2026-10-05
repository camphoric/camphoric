/**
 * Stories for the phone widget (SPEC §9.1, DR-30). It starts at `+1` (US) and
 * saves numbers in E.164 form. A number filled in all at once, as browser
 * autofill and paste do, without a `+` (`(202) 555-1234`) is a number in the
 * selected country; one with `+` and another country code switches the
 * country. Also a render target for the Playwright e2e suite.
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

const uiSchema: UiSchema = { phone: { 'ui:widget': 'PhoneInput' } };

export default { title: 'Phone Input' } satisfies Meta;

const PhoneForm = ({ initial = {} }: { initial?: { phone?: string } }) => {
  const [formData, setFormData] = useState<unknown>(initial);
  return (
    <Stack maw={420} p="md">
      <JsonSchemaForm
        schema={schema}
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

/** A saved number from another country shows that country's flag. */
export const International: StoryFn = () => <PhoneForm initial={{ phone: '+442079460958' }} />;
