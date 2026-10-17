/**
 * Stories for Template Help's Markdown reference (SPEC §9.3). Run
 * `npm run storybook`.
 */

import { Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { MarkdownReference } from '../MarkdownReference';

export default { title: 'Markdown Reference' } satisfies Meta;

export const Email: StoryFn = () => (
  <Stack maw={720} p="md">
    <MarkdownReference context="confirmation_email" onInsert={() => {}} />
  </Stack>
);

export const Report: StoryFn = () => (
  <Stack maw={720} p="md">
    <MarkdownReference context="report" />
  </Stack>
);

export const Searched: StoryFn = () => (
  <Stack maw={720} p="md">
    <MarkdownReference context="report" query="table" />
  </Stack>
);
