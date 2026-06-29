/**
 * Ladle stories for the custom rjsf fields (SPEC §9.1). Each is exercised through
 * the JsonSchemaForm engine with a representative schema, alongside a live view
 * of the form data. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Code, Stack, Title } from '@mantine/core';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { JsonSchemaForm } from 'components/form';
import { useState } from 'react';

/** Campers — an array of campers with ordinal headings and add/remove controls. */
export const Campers: Story = () => {
  const [formData, setFormData] = useState<unknown>({ campers: [{}, {}] });
  const schema: RJSFSchema = {
    type: 'object',
    properties: {
      campers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            first_name: { type: 'string', title: 'First name' },
            age: { type: 'integer', title: 'Age' },
          },
        },
      },
    },
  };
  const uiSchema: UiSchema = { campers: { 'ui:field': 'Campers' } };
  return (
    <Stack maw={560} p="md">
      <Title order={4}>Campers</Title>
      <JsonSchemaForm schema={schema} uiSchema={uiSchema} formData={formData} onChange={setFormData} />
      <Code block>{JSON.stringify(formData, null, 2)}</Code>
    </Stack>
  );
};

/** LodgingRequested — a cascading select over a lodging tree, leaf-only final choice. */
export const LodgingRequested: Story = () => {
  const [formData, setFormData] = useState<unknown>({});
  const schema: RJSFSchema = {
    type: 'object',
    properties: { lodging_requested: { type: 'object', title: 'Requested lodging' } },
  };
  const lodgingNodes = [
    { id: 1, parent: null, name: 'Camp', children_title: 'Area', remaining_unreserved_capacity: 40 },
    { id: 2, parent: 1, name: 'Cabins', children_title: 'Cabin', remaining_unreserved_capacity: 20 },
    { id: 3, parent: 1, name: 'Tent Field', children_title: 'Spot', remaining_unreserved_capacity: 20 },
    { id: 4, parent: 2, name: 'Cabin A', children_title: '', remaining_unreserved_capacity: 4 },
    { id: 5, parent: 2, name: 'Cabin B', children_title: '', remaining_unreserved_capacity: 0 },
    { id: 6, parent: 3, name: 'Spot 1', children_title: '', remaining_unreserved_capacity: 2 },
  ];
  const uiSchema: UiSchema = {
    lodging_requested: { 'ui:field': 'LodgingRequested', lodging_nodes: lodgingNodes },
  };
  return (
    <Stack maw={560} p="md">
      <Title order={4}>Requested lodging</Title>
      <JsonSchemaForm schema={schema} uiSchema={uiSchema} formData={formData} onChange={setFormData} />
      <Code block>{JSON.stringify(formData, null, 2)}</Code>
    </Stack>
  );
};
