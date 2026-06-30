/**
 * Ladle story for the KeyValueEdit component (SPEC §9.6). Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Code, Stack, Title } from '@mantine/core';
import { useState } from 'react';

import { KeyValueEdit, type KeyValueMap } from './KeyValueEdit';

export const Pricing: Story = () => {
  const [value, setValue] = useState<KeyValueMap>({ adult: 100, child: 50 });
  return (
    <Stack maw={480} p="md">
      <Title order={4}>Pricing (integer values)</Title>
      <KeyValueEdit value={value} valueType="integer" onChange={setValue} />
      <Code block>{JSON.stringify(value, null, 2)}</Code>
    </Stack>
  );
};

export const TemplateVars: Story = () => {
  const [value, setValue] = useState<KeyValueMap>({ camp_name: 'Summer Camp' });
  return (
    <Stack maw={480} p="md">
      <Title order={4}>Template values (string values)</Title>
      <KeyValueEdit value={value} valueType="string" onChange={setValue} />
      <Code block>{JSON.stringify(value, null, 2)}</Code>
    </Stack>
  );
};
