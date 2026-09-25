/**
 * Ladle story for the filters/tests/tags reference (SPEC §9.3). Run
 * `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Stack } from '@mantine/core';
import { sampleDescription } from 'components/TemplateEditor/sampleDescription';

import { TemplateSyntaxReference } from './TemplateSyntaxReference';

export const All: Story = () => (
  <Stack maw={720} p="md">
    <TemplateSyntaxReference description={sampleDescription} onInsert={() => {}} />
  </Stack>
);

export const Searched: Story = () => (
  <Stack maw={720} p="md">
    <TemplateSyntaxReference description={sampleDescription} query="date" />
  </Stack>
);
