/**
 * Story for the time zone select (SPEC §8.3; §15, DR-97). Run `npm run storybook`.
 */

import { Code, Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { useState } from 'react';

import { TimeZoneSelect } from '../TimeZoneSelect';

export default { title: 'Time Zone Select' } satisfies Meta;

export const Basic: StoryFn = () => {
  const [zone, setZone] = useState('America/Los_Angeles');
  return (
    <Stack maw={360} p="md">
      <TimeZoneSelect label="Time zone" value={zone} onChange={setZone} />
      <Code block data-testid="value">
        {zone}
      </Code>
    </Stack>
  );
};
