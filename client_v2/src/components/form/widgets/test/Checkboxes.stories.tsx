/**
 * Stories for the checkboxes widget (SPEC §9.1). The choices are saved in the
 * order the options are listed, whatever order they're ticked in — tick a few
 * days out of order and watch the form data. Also a render target for the
 * Playwright e2e suite.
 */

import { Code, Stack, Title } from '@mantine/core';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { JsonSchemaForm } from 'components/form';
import { useState } from 'react';

const schema: RJSFSchema = {
  type: 'object',
  properties: {
    attendance: {
      type: 'array',
      title: 'When will you attend?',
      description: 'Each camp day starts at 2pm and ends at 2pm the following day.',
      uniqueItems: true,
      minItems: 1,
      items: {
        type: 'string',
        enum: ['Wed Dec 30', 'Thu Dec 31', 'Fri Jan 1', 'Sat Jan 2', 'Sun Jan 3'],
      },
    },
  },
};

const uiSchema: UiSchema = { attendance: { 'ui:widget': 'checkboxes' } };

export default { title: 'Checkboxes' } satisfies Meta;

const DaysForm = ({ inline = false }: { inline?: boolean }) => {
  const [formData, setFormData] = useState<unknown>({});
  return (
    <Stack maw={560} p="md">
      <JsonSchemaForm
        schema={schema}
        uiSchema={{ attendance: { ...uiSchema.attendance, 'ui:options': { inline } } }}
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

/** One checkbox per line. */
export const Days: StoryFn = () => <DaysForm />;

/** The same choices side by side (`ui:options.inline`). */
export const Inline: StoryFn = () => <DaysForm inline />;
