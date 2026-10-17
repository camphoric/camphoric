/**
 * Stories for the select widget (SPEC §9.1). Choosing the option that's
 * already chosen keeps it; an optional dropdown has a clear button instead,
 * and a required one has none. Watch the form data while you try both. Also a
 * render target for the Playwright e2e suite.
 */

import { Code, Stack, Title } from '@mantine/core';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { JsonSchemaForm } from 'components/form';
import { useState } from 'react';

const schema: RJSFSchema = {
  type: 'object',
  required: ['first_time', 'driving'],
  properties: {
    first_time: {
      type: 'boolean',
      title: 'This is my first time attending camp',
      default: false,
    },
    driving: {
      type: 'string',
      title: 'Will you be driving?',
      description: 'Answering this helps us plan **parking**.',
      enum: ['Driver', 'Passenger', 'Not sure yet'],
    },
    meal_type: {
      type: 'string',
      title: 'Meals (optional)',
      enum: ['Omnivore', 'Vegetarian', 'Vegan'],
    },
  },
};

const uiSchema: UiSchema = {
  first_time: { 'ui:enumNames': { false: 'No', true: 'Yes' } },
  driving: { 'ui:placeholder': 'Choose an option' },
  meal_type: { 'ui:placeholder': 'Choose an option' },
};

export default { title: 'Select' } satisfies Meta;

/** A required yes/no (labeled booleans render as a dropdown), a required and an optional enum. */
export const RequiredAndOptional: StoryFn = () => {
  const [formData, setFormData] = useState<unknown>({});
  return (
    <Stack maw={560} p="md">
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
