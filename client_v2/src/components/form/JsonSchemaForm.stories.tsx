/**
 * Ladle stories for the form engine — a live playground to try the custom and
 * base widgets. Run `npm run ladle`. These also serve as render targets for
 * future Playwright e2e coverage.
 */

import type { Story } from '@ladle/react';
import { Code, Stack, Title } from '@mantine/core';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { JsonSchemaForm } from 'components/form';
import { useState } from 'react';

const schema: RJSFSchema = {
  type: 'object',
  // Templated description — rendered via the Handlebars + markdown pipeline.
  description: 'Registration for **{{eventName}}**',
  required: ['full_name', 'email'],
  properties: {
    full_name: { type: 'string', title: 'Full name' },
    email: { type: 'string', title: 'Email', format: 'email' },
    phone: { type: 'string', title: 'Phone' },
    party_size: { type: 'integer', title: 'Party size' },
    birthdate: { type: 'string', format: 'date', title: 'Birth date' },
    t_shirt: { type: 'string', title: 'T-shirt size', enum: ['S', 'M', 'L', 'XL'] },
    meals: {
      type: 'array',
      title: 'Meals',
      uniqueItems: true,
      items: { type: 'string', enum: ['Breakfast', 'Lunch', 'Dinner'] },
    },
    notes: {
      type: 'string',
      title: 'Notes',
      maxLength: 20,
      description: 'Limited to 20 characters (the textarea truncates).',
    },
  },
};

const uiSchema: UiSchema = {
  phone: { 'ui:widget': 'phone' },
  party_size: { 'ui:widget': 'naturalNumber' },
  meals: { 'ui:widget': 'checkboxes', 'ui:options': { inline: true } },
  notes: { 'ui:widget': 'textarea', 'ui:options': { rows: 3 } },
};

/** Every custom + base widget on one form, with a live view of the form data. */
export const AllWidgets: Story = () => {
  const [formData, setFormData] = useState<unknown>({});
  return (
    <Stack maw={560} p="md">
      <Title order={4}>Form widgets</Title>
      <JsonSchemaForm
        schema={schema}
        uiSchema={uiSchema}
        formData={formData}
        templateData={{ eventName: 'Summer Camp 2026' }}
        onChange={setFormData}
        onSubmit={(data) => setFormData(data)}
      />
      <Title order={6}>Live form data</Title>
      <Code block>{JSON.stringify(formData, null, 2)}</Code>
    </Stack>
  );
};

/** The same form rendered read-only via the wrapper's `disabled` flag. */
export const Disabled: Story = () => (
  <Stack maw={560} p="md">
    <JsonSchemaForm
      schema={schema}
      uiSchema={uiSchema}
      formData={{
        full_name: 'Ada Lovelace',
        phone: '+12025551234',
        party_size: 3,
        birthdate: '2026-06-29',
      }}
      templateData={{ eventName: 'Summer Camp 2026' }}
      disabled
    />
  </Stack>
);
