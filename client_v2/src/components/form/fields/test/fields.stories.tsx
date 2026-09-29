/**
 * Stories for the custom rjsf fields (SPEC §9.1). Each is exercised through
 * the JsonSchemaForm engine with a representative schema, alongside a live view
 * of the form data. Run `npm run storybook`.
 */

import { Code, Stack, Title } from '@mantine/core';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { JsonSchemaForm } from 'components/form';
import { useState } from 'react';

/** Campers — an array of campers with ordinal headings and add/remove controls. */
export default { title: 'Fields' } satisfies Meta;

export const Campers: StoryFn = () => {
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
      <JsonSchemaForm
        schema={schema}
        uiSchema={uiSchema}
        formData={formData}
        onChange={setFormData}
      />
      <Code block>{JSON.stringify(formData, null, 2)}</Code>
    </Stack>
  );
};

/** LodgingRequested — a cascading select over a lodging tree, leaf-only final choice. */
export const LodgingRequested: StoryFn = () => {
  const [formData, setFormData] = useState<unknown>({});
  const schema: RJSFSchema = {
    type: 'object',
    properties: { lodging_requested: { type: 'object', title: 'Requested lodging' } },
  };
  const lodgingNodes = [
    {
      id: 1,
      parent: null,
      name: 'Camp',
      children_title: 'Area',
      remaining_unreserved_capacity: 40,
    },
    {
      id: 2,
      parent: 1,
      name: 'Cabins',
      children_title: 'Cabin',
      remaining_unreserved_capacity: 20,
    },
    {
      id: 3,
      parent: 1,
      name: 'Tent Field',
      children_title: 'Spot',
      remaining_unreserved_capacity: 20,
    },
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
      <JsonSchemaForm
        schema={schema}
        uiSchema={uiSchema}
        formData={formData}
        onChange={setFormData}
      />
      <Code block>{JSON.stringify(formData, null, 2)}</Code>
    </Stack>
  );
};

/**
 * LodgingRequested — lodging an organizer has marked (#602): the tent field is
 * marked full though it has room, and Cabin B is marked open though it has none.
 */
export const LodgingRequestedMarked: StoryFn = () => {
  const [formData, setFormData] = useState<unknown>({});
  const schema: RJSFSchema = {
    type: 'object',
    properties: { lodging_requested: { type: 'object', title: 'Requested lodging' } },
  };
  const node = (
    id: number,
    parent: number | null,
    name: string,
    remaining: number,
    full: boolean,
  ) => ({
    id,
    parent,
    name,
    children_title: id === 1 ? 'Area' : id === 2 ? 'Cabin' : 'Spot',
    remaining_unreserved_capacity: remaining,
    full,
  });
  const lodgingNodes = [
    node(1, null, 'Camp', 40, false),
    node(2, 1, 'Cabins', 4, false),
    node(3, 1, 'Tent Field', 20, true),
    node(4, 2, 'Cabin A', 4, false),
    node(5, 2, 'Cabin B', 0, false),
    node(6, 3, 'Spot 1', 2, false),
  ];
  const uiSchema: UiSchema = {
    lodging_requested: { 'ui:field': 'LodgingRequested', lodging_nodes: lodgingNodes },
  };
  return (
    <Stack maw={560} p="md">
      <Title order={4}>Requested lodging</Title>
      <JsonSchemaForm
        schema={schema}
        uiSchema={uiSchema}
        formData={formData}
        onChange={setFormData}
      />
      <Code block>{JSON.stringify(formData, null, 2)}</Code>
    </Stack>
  );
};

/**
 * LodgingRequested — an unfinished choice. "RV Camping" needs an RV length from
 * the second dropdown; submit to see the event's validation message under the
 * unfinished dropdown and in the list at the top.
 */
export const LodgingRequestedUnfinished: StoryFn = () => {
  const [formData, setFormData] = useState<unknown>({
    lodging_requested: { choices: [2] },
  });
  const schema: RJSFSchema = {
    type: 'object',
    properties: {
      lodging_requested: {
        type: 'object',
        title: 'Requested lodging',
        required: ['id', 'choices'],
        properties: { id: { type: 'number' }, choices: { type: 'array', minItems: 1 } },
      },
    },
  };
  const lodgingNodes = [
    {
      id: 1,
      parent: null,
      name: 'Lodging',
      children_title: 'Select your lodging',
      remaining_unreserved_capacity: 40,
    },
    {
      id: 2,
      parent: 1,
      name: 'RV Camping',
      children_title: 'RV length',
      remaining_unreserved_capacity: 20,
    },
    {
      id: 3,
      parent: 1,
      name: 'Tent Camping',
      children_title: '',
      remaining_unreserved_capacity: 20,
    },
    {
      id: 4,
      parent: 2,
      name: "RV under 15' long",
      children_title: '',
      remaining_unreserved_capacity: 10,
    },
    {
      id: 5,
      parent: 2,
      name: "RV 15'-20' long",
      children_title: '',
      remaining_unreserved_capacity: 10,
    },
  ];
  const uiSchema: UiSchema = {
    lodging_requested: { 'ui:field': 'LodgingRequested', lodging_nodes: lodgingNodes },
  };
  return (
    <Stack maw={560} p="md">
      <Title order={4}>Requested lodging (unfinished)</Title>
      <JsonSchemaForm
        schema={schema}
        uiSchema={uiSchema}
        formData={formData}
        onChange={setFormData}
        errorMessages={{
          rules: {
            'lodging_requested.id': {
              required: 'Please finish choosing your lodging — pick your RV length',
            },
          },
        }}
      />
      <Code block>{JSON.stringify(formData, null, 2)}</Code>
    </Stack>
  );
};
