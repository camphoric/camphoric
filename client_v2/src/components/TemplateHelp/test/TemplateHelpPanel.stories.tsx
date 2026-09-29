/**
 * Stories for Template Help (SPEC §9.3), with a real variable spec
 * (Camp Harmony's, trimmed). Run `npm run storybook`.
 */

import { Code, Stack, Text } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { sampleDescription } from 'components/TemplateEditor/sampleDescription';
import { useState } from 'react';

import { TemplateHelpPanel } from '../TemplateHelpPanel';

export default { title: 'Template Help Panel' } satisfies Meta;

export const Report: StoryFn = () => (
  <Stack maw={720} p="md">
    <TemplateHelpPanel description={sampleDescription} context="report" />
  </Stack>
);

export const ConfirmationEmail: StoryFn = () => (
  <Stack maw={720} p="md">
    <TemplateHelpPanel description={sampleDescription} context="confirmation_email" />
  </Stack>
);

export const WithInsert: StoryFn = () => {
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

export const Guide: StoryFn = () => (
  <Stack maw={720} p="md">
    <TemplateHelpPanel description={sampleDescription} context="report" tab="guide" />
  </Stack>
);

export const Loading: StoryFn = () => (
  <Stack maw={720} p="md">
    <TemplateHelpPanel context="report" />
  </Stack>
);
