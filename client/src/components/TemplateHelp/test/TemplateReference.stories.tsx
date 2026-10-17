/**
 * Stories for the variables reference (SPEC §9.3). Run `npm run storybook`.
 */

import { Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { sampleDescription } from 'components/TemplateEditor/sampleDescription';

import { TemplateReference } from '../TemplateReference';

export default { title: 'Template Reference' } satisfies Meta;

export const InvitationEmail: StoryFn = () => (
  <Stack maw={720} p="md">
    <TemplateReference description={sampleDescription} context="invitation_email" />
  </Stack>
);

export const Searched: StoryFn = () => (
  <Stack maw={720} p="md">
    <TemplateReference
      description={sampleDescription}
      context="report"
      query="lodging"
      onInsert={() => {}}
    />
  </Stack>
);

export const NoMatch: StoryFn = () => (
  <Stack maw={720} p="md">
    <TemplateReference description={sampleDescription} context="report" query="zzz" />
  </Stack>
);
