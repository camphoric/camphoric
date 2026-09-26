/**
 * Ladle stories for the variables reference (SPEC §9.3). Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Stack } from '@mantine/core';
import { sampleDescription } from 'components/TemplateEditor/sampleDescription';

import { TemplateReference } from '../TemplateReference';

export const InvitationEmail: Story = () => (
  <Stack maw={720} p="md">
    <TemplateReference description={sampleDescription} context="invitation_email" />
  </Stack>
);

export const Searched: Story = () => (
  <Stack maw={720} p="md">
    <TemplateReference
      description={sampleDescription}
      context="report"
      query="lodging"
      onInsert={() => {}}
    />
  </Stack>
);

export const NoMatch: Story = () => (
  <Stack maw={720} p="md">
    <TemplateReference description={sampleDescription} context="report" query="zzz" />
  </Stack>
);
