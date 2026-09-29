/**
 * Stories for the form engine — a live playground to try the custom and
 * base widgets. Run `npm run storybook`. These also serve as render targets for
 * future Playwright e2e coverage.
 */

import { Code, Stack, Title } from '@mantine/core';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { JsonSchemaForm } from 'components/form';
import { useState } from 'react';

const schema: RJSFSchema = {
  type: 'object',
  // Templated description — rendered via the Handlebars + markdown pipeline.
  description: 'Registration for **{{eventName}}**',
  required: ['full_name', 'email'],
  properties: {
    full_name: { type: 'string', title: 'Full name', description: 'As it appears on your ID.' },
    email: { type: 'string', title: 'Email', format: 'email' },
    phone: {
      type: 'string',
      title: 'Phone',
      description: 'Mobile preferred — we text arrival updates.',
    },
    party_size: { type: 'integer', title: 'Party size', description: 'Including yourself.' },
    birthdate: {
      type: 'string',
      format: 'date',
      title: 'Birth date',
      description: 'Used to work out the age group.',
    },
    t_shirt: {
      type: 'string',
      title: 'T-shirt size',
      description: 'Sizes run **large** — when in doubt, size down.',
      enum: ['S', 'M', 'L', 'XL'],
    },
    membership: { type: 'boolean', title: 'Membership' },
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
  phone: { 'ui:widget': 'PhoneInput' },
  party_size: { 'ui:widget': 'NaturalNumberInput' },
  t_shirt: { 'ui:enumNames': { S: 'Small', M: 'Medium', L: 'Large', XL: 'Extra large' } },
  membership: {
    'ui:placeholder': 'Choose an option',
    'ui:enumNames': { false: 'No, I am not yet a member', true: 'Yes, I am a current member' },
  },
  meals: { 'ui:widget': 'checkboxes', 'ui:options': { inline: true } },
  notes: { 'ui:widget': 'textarea', 'ui:options': { rows: 3 } },
};

/** Every custom + base widget on one form, with a live view of the form data. */
export default { title: 'JSON Schema Form' } satisfies Meta;

export const AllWidgets: StoryFn = () => {
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
export const Disabled: StoryFn = () => (
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

const listSchema: RJSFSchema = {
  type: 'object',
  properties: {
    parking_passes: {
      type: 'array',
      title: 'Parking Passes',
      description: '**ALL vehicles** need a parking pass.',
      maxItems: 4,
      items: {
        type: 'object',
        title: 'parking pass',
        properties: {
          vehicle_type: {
            type: 'string',
            title: 'Vehicle Type',
            enum: ['Regular car', "RV under 15' long"],
            default: 'Regular car',
          },
          pass_type: {
            type: 'string',
            title: 'Parking Type',
            enum: ['Long Term', 'Short Term'],
            default: 'Long Term',
          },
        },
      },
    },
    helpers: {
      type: 'array',
      title: 'Helpers, in order of preference',
      items: { type: 'string', title: 'helper' },
    },
  },
};

const listUiSchema: UiSchema = {
  parking_passes: {
    'ui:options': { addButtonText: 'Add A Parking Pass' },
    items: { pass_type: { 'ui:classNames': 'camphoric-hide-during-registration' } },
  },
  helpers: { 'ui:options': { orderable: true } },
};

/**
 * Lists (SPEC §9.1; DR-49): a section heading, each item in its own box with
 * its × in the corner, and a labelled add button. Parking Type has the
 * registration-only hide class, so it shows here (outside registration) but
 * not on the registration page; the helpers list opts into reordering.
 */
export const Lists: StoryFn = () => {
  const [formData, setFormData] = useState<unknown>({
    parking_passes: [{ vehicle_type: 'Regular car', pass_type: 'Long Term' }],
    helpers: ['Pat', 'Sam'],
  });
  return (
    <Stack maw={640} p="md">
      <JsonSchemaForm
        schema={listSchema}
        uiSchema={listUiSchema}
        formData={formData}
        onChange={setFormData}
      />
      <Code block data-testid="list-data">
        {JSON.stringify(formData, null, 2)}
      </Code>
    </Stack>
  );
};

/** The same lists on the registration page, where Parking Type is hidden. */
export const ListsDuringRegistration: StoryFn = () => (
  <Stack maw={640} p="md" className="camphoric-registration">
    <JsonSchemaForm
      schema={listSchema}
      uiSchema={listUiSchema}
      formData={{ parking_passes: [{}], helpers: [] }}
    />
  </Stack>
);
