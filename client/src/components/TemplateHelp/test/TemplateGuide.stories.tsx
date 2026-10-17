/**
 * Story for the Template Help guides (SPEC §9.3). Run `npm run storybook`.
 */

import { Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { useState } from 'react';

import { DEFAULT_TOPIC } from '../guides';
import { TemplateGuide } from '../TemplateGuide';

export default { title: 'Template Guide' } satisfies Meta;

export const Guides: StoryFn = () => {
  const [topic, setTopic] = useState(DEFAULT_TOPIC);
  return (
    <Stack maw={720} p="md">
      <TemplateGuide topic={topic} onTopicChange={setTopic} />
    </Stack>
  );
};
