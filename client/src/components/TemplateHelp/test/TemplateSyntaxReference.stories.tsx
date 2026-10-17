/**
 * Story for the filters/tests/tags reference (SPEC §9.3). Run
 * `npm run storybook`.
 */

import { Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { sampleDescription } from 'components/TemplateEditor/sampleDescription';

import { TemplateSyntaxReference } from '../TemplateSyntaxReference';

export default { title: 'Template Syntax Reference' } satisfies Meta;

export const All: StoryFn = () => (
  <Stack maw={720} p="md">
    <TemplateSyntaxReference description={sampleDescription} onInsert={() => {}} />
  </Stack>
);

export const Searched: StoryFn = () => (
  <Stack maw={720} p="md">
    <TemplateSyntaxReference description={sampleDescription} query="date" />
  </Stack>
);
