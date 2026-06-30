/**
 * Ladle story for AdminAttributesForm (SPEC §8.4, §8.5). Exercises the combined
 * `*_admin_schema` map through the real form engine, plus the empty case (which
 * renders nothing). Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Code, Stack, Title } from '@mantine/core';
import type { Hash } from 'api-types';
import { useState } from 'react';

import { AdminAttributesForm } from './AdminAttributesForm';

const adminSchema = {
  vip: {
    data: {
      type: 'object',
      title: 'VIP status',
      properties: { vip_notes: { type: 'string', title: 'VIP notes' } },
    },
    ui: {},
  },
  flags: {
    data: {
      type: 'object',
      title: 'Flags',
      properties: { needs_review: { type: 'boolean', title: 'Needs review' } },
    },
    ui: {},
  },
};

export const Populated: Story = () => {
  const [saved, setSaved] = useState<Hash>();
  return (
    <Stack maw={520} p="md">
      <AdminAttributesForm
        adminSchema={adminSchema}
        value={{ vip: { vip_notes: 'Major sponsor' } }}
        onSave={setSaved}
        saving={false}
      />
      <Title order={6}>Last saved</Title>
      <Code block>{JSON.stringify(saved, null, 2)}</Code>
    </Stack>
  );
};

export const Empty: Story = () => (
  <Stack maw={520} p="md">
    <Title order={6}>An empty admin schema renders nothing below:</Title>
    <AdminAttributesForm adminSchema={{}} value={{}} onSave={() => undefined} saving={false} />
  </Stack>
);
