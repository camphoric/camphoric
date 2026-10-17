/**
 * Stories for the notice on an editor whose record someone else deleted
 * meanwhile (SPEC §9.8). Run `npm run storybook`.
 */

import { Stack, TextInput } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { RecordDeleted } from '../RecordDeleted';

export default { title: 'Record Deleted' } satisfies Meta;

export const OverAnEditor: StoryFn = () => (
  <Stack m="md" maw={560}>
    <RecordDeleted label="report" />
    <TextInput label="Title" defaultValue="Cabin roster (my unsaved change)" />
  </Stack>
);
