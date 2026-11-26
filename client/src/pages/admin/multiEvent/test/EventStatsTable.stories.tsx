/**
 * Stories for the included events side by side (SPEC §8.12; §15 DR-180): new
 * and returning people, and how many came back from the event before. Run
 * `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { EventStatsTable } from '../EventStatsTable';
import { STATS_EVENTS } from './fixtures';

export default { title: 'Event Stats Table' } satisfies Meta;

export const TwoYears: StoryFn = () => (
  <Box p="md">
    <EventStatsTable rows={STATS_EVENTS} />
  </Box>
);
export const NoEvents: StoryFn = () => (
  <Box p="md">
    <EventStatsTable rows={[]} />
  </Box>
);
