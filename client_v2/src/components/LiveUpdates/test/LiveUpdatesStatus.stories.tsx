/**
 * Stories for the live-updates status (SPEC §9.8, DR-112): what the header
 * shows when the event's live updates aren't coming in. Run `npm run storybook`.
 */

import { Group } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { LiveUpdatesStatus } from '../LiveUpdatesStatus';

export default { title: 'Live Updates Status' } satisfies Meta;

export const Reconnecting: StoryFn = () => (
  <Group m="md">
    <LiveUpdatesStatus state="reconnecting" />
  </Group>
);
export const Off: StoryFn = () => (
  <Group m="md">
    <LiveUpdatesStatus state="off" />
  </Group>
);
