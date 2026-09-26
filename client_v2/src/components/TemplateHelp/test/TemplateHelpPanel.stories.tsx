/**
 * Ladle stories for Template Help (SPEC §9.3), with a real variable spec
 * (Camp Harmony's, trimmed). Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Code, Stack, Text } from '@mantine/core';
import { sampleDescription } from 'components/TemplateEditor/sampleDescription';
import { useState } from 'react';

import { TemplateHelpPanel } from '../TemplateHelpPanel';

export const Report: Story = () => (
  <Stack maw={720} p="md">
    <TemplateHelpPanel description={sampleDescription} context="report" />
  </Stack>
);

export const ConfirmationEmail: Story = () => (
  <Stack maw={720} p="md">
    <TemplateHelpPanel description={sampleDescription} context="confirmation_email" />
  </Stack>
);

export const WithInsert: Story = () => {
  const [inserted, setInserted] = useState('');
  return (
    <Stack maw={560} p="md">
      <Text size="sm">
        Inserted: <Code>{inserted}</Code>
      </Text>
      <TemplateHelpPanel
        description={sampleDescription}
        context="report"
        onInsert={(text) => setInserted((prev) => prev + text)}
      />
    </Stack>
  );
};

export const Guide: Story = () => (
  <Stack maw={720} p="md">
    <TemplateHelpPanel description={sampleDescription} context="report" tab="guide" />
  </Stack>
);

export const Loading: Story = () => (
  <Stack maw={720} p="md">
    <TemplateHelpPanel context="report" />
  </Stack>
);
