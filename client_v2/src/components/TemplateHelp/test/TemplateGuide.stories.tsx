/**
 * Ladle story for the Template Help guides (SPEC §9.3). Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Stack } from '@mantine/core';
import { useState } from 'react';

import { DEFAULT_TOPIC } from '../guides';
import { TemplateGuide } from '../TemplateGuide';

export const Guides: Story = () => {
  const [topic, setTopic] = useState(DEFAULT_TOPIC);
  return (
    <Stack maw={720} p="md">
      <TemplateGuide topic={topic} onTopicChange={setTopic} />
    </Stack>
  );
};
