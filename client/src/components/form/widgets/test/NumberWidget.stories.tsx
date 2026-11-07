/**
 * Stories for the number widget (SPEC §9.1, DR-161): every `number` and
 * `integer` field without a `ui:widget`. A minus sign can't be typed when the
 * minimum is 0 or more, nor a decimal point for an integer; any other value out
 * of range stays as typed and is rejected with its limit message when the form
 * is submitted, never clamped. Its description is markdown, like every field's.
 * Also a render target for the Playwright e2e suite.
 */

import { Code, Stack, Title } from '@mantine/core';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { JsonSchemaForm } from 'components/form';
import { useState } from 'react';

export default { title: 'Number Widget' } satisfies Meta;

const NumberForm = ({ schema, uiSchema }: { schema: RJSFSchema; uiSchema?: UiSchema }) => {
  const [formData, setFormData] = useState<unknown>({});
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

/** A whole-dollar donation (minimum 0, a `$` prefix) whose description has a link. */
export const Donation: StoryFn = () => (
  <NumberForm
    schema={{
      type: 'object',
      properties: {
        donation: {
          type: 'integer',
          title: 'Donation',
          minimum: 0,
          description: 'Or you may give at [our website](https://example.org/).',
        },
      },
    }}
    uiSchema={{ donation: { 'ui:options': { prefix: '$' } } }}
  />
);

/** Between 5 and 100: try 3 or 150, then submit. */
export const Limits: StoryFn = () => (
  <NumberForm
    schema={{
      type: 'object',
      properties: { count: { type: 'integer', title: 'Count', minimum: 5, maximum: 100 } },
    }}
  />
);

/** No limits: negative and decimal numbers are fine. */
export const AnyNumber: StoryFn = () => (
  <NumberForm
    schema={{ type: 'object', properties: { adjustment: { type: 'number', title: 'Adjustment' } } }}
  />
);
