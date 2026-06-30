/**
 * Ladle story for the Address field (SPEC §9.1). Shows the plain-input composite
 * (street/city/state/zip + country select). With a Google Maps API key
 * configured (VITE_GOOGLE_MAPS_API_KEY), the street field becomes a Places
 * autocomplete that populates the rest (DR-23); without one it stays plain.
 */

import type { Story } from '@ladle/react';
import { Code, Stack, Title } from '@mantine/core';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { JsonSchemaForm } from 'components/form';
import { useState } from 'react';

const schema: RJSFSchema = {
  type: 'object',
  properties: {
    address: {
      type: 'object',
      title: 'Mailing address',
      properties: {
        street_address: { type: 'string', title: 'Street address' },
        city: { type: 'string', title: 'City' },
        state_or_province: { type: 'string', title: 'State / Province' },
        zip_code: { type: 'string', title: 'ZIP / Postal code' },
        country: {
          type: 'string',
          title: 'Country',
          enum: ['United States', 'Canada', 'Mexico'],
          default: 'United States',
        },
      },
    },
  },
};
const uiSchema: UiSchema = { address: { 'ui:field': 'Address' } };

export const Address: Story = () => {
  const [formData, setFormData] = useState<unknown>({});
  return (
    <Stack maw={520} p="md">
      <Title order={4}>Address</Title>
      <JsonSchemaForm schema={schema} uiSchema={uiSchema} formData={formData} onChange={setFormData} />
      <Code block>{JSON.stringify(formData, null, 2)}</Code>
    </Stack>
  );
};
