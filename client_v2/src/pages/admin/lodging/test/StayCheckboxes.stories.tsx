/**
 * Stories for choosing the days a camper is present (SPEC §8.5, §8.6): a
 * five-day event, whose last day is departure day and isn't offered, and a
 * one-day event, whose only day is. Run `npm run storybook`.
 */

import { Box, Text } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { useState } from 'react';

import { StayCheckboxes } from '../StayCheckboxes';
import { stayText } from '../timelineUtils';

function Frame({ days, initial }: { days: string[]; initial: string[] }) {
  const [stay, setStay] = useState(initial);
  return (
    <Box p="md" maw={320}>
      <StayCheckboxes days={days} value={stay} onChange={setStay} description={stayText(stay)} />
      <Text size="sm" mt="md" data-testid="stay">
        Stay: {stay.join(', ')}
      </Text>
    </Box>
  );
}

export default { title: 'Stay Checkboxes' } satisfies Meta;

export const FiveDays: StoryFn = () => (
  <Frame
    days={['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19']}
    initial={['2026-10-16', '2026-10-17']}
  />
);
export const OneDay: StoryFn = () => <Frame days={['2026-10-15']} initial={[]} />;
