/**
 * Stories for the camper editor's Lodging tab (SPEC §8.5): a camper placed
 * with others (each opening that camper), whose days present can be changed;
 * one alone in a unit; one not yet placed; and a Reporter's, who can't change
 * the days. Run `npm run storybook`.
 */

import { Box, Text } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { PermissionsProvider } from 'hooks/permissions';
import { useState } from 'react';

import { CamperLodging } from '../CamperLodging';
import type { CamperLodgingSummary } from '../camperLodgingSummary';

const PLACED: CamperLodgingSummary = {
  path: 'Camp 1 → Cabins → Cabin A',
  stay: ['2026-10-16', '2026-10-17', '2026-10-18'],
  notes: 'The ladder to the top bunk is broken, so keep the lower bunks for younger campers.',
  others: [
    { id: 3, name: 'Annie Ross', stay: ['2026-10-16'] },
    { id: 2, name: 'Jane Ross', stay: ['2026-10-17', '2026-10-18'] },
  ],
};

const ALONE: CamperLodgingSummary = {
  path: 'Off Site',
  stay: ['2026-10-16', '2026-10-18'],
  notes: '',
  others: [],
};

const DAYS = ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'];

const UNASSIGNED: CamperLodgingSummary = { path: null, stay: [], notes: '', others: [] };

export default { title: 'Camper Lodging' } satisfies Meta;

function Tab({ summary }: { summary: CamperLodgingSummary }) {
  const [opened, setOpened] = useState('nothing');
  const [stay, setStay] = useState(summary.stay);
  return (
    <Box p="md" maw={520}>
      <CamperLodging
        summary={summary}
        days={DAYS}
        stay={stay}
        onStayChange={setStay}
        onSelectCamper={(id) => setOpened(`camper ${id}`)}
        onOpenLodging={() => setOpened('lodging')}
      />
      <Text size="sm" mt="md" data-testid="opened">
        Opened: {opened}
      </Text>
      <Text size="sm" data-testid="stay">
        Stay: {stay.join(', ')}
      </Text>
    </Box>
  );
}

export const Placed: StoryFn = () => <Tab summary={PLACED} />;
export const Alone: StoryFn = () => <Tab summary={ALONE} />;
export const Unassigned: StoryFn = () => <Tab summary={UNASSIGNED} />;
export const ForAReporter: StoryFn = () => (
  <PermissionsProvider userRole="reporter">
    <Tab summary={PLACED} />
  </PermissionsProvider>
);
