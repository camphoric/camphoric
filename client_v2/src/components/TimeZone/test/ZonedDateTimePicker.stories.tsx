/**
 * Stories for the zoned date-time picker (SPEC §8.3; §15, DR-97): the clock time
 * is the camp's, not the browser's. Run `npm run storybook`.
 */

import { Code, Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { useState } from 'react';

import { ZonedDateTimePicker } from '../ZonedDateTimePicker';

function Frame({ initial, timeZone }: { initial: string | null; timeZone: string }) {
  const [value, setValue] = useState(initial);
  return (
    <Stack maw={360} p="md">
      <ZonedDateTimePicker
        label="Registration closes"
        value={value}
        timeZone={timeZone}
        onChange={setValue}
      />
      <Code block data-testid="value">
        {JSON.stringify(value)}
      </Code>
    </Stack>
  );
}

export default { title: 'Zoned Date Time Picker' } satisfies Meta;

/** 2 PM in California, stored as 22:00 UTC. */
export const Pacific: StoryFn = () => (
  <Frame initial="2026-12-13T22:00:00Z" timeZone="America/Los_Angeles" />
);
/** The same instant, read at a camp in New York: 5 PM. */
export const Eastern: StoryFn = () => (
  <Frame initial="2026-12-13T22:00:00Z" timeZone="America/New_York" />
);
export const Empty: StoryFn = () => <Frame initial={null} timeZone="America/Los_Angeles" />;
