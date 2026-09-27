/**
 * Ladle stories for a registration's change history (SPEC §8.4; §15, DR-53):
 * edits grouped with the pricing they recalculated, a camper deleted and
 * restored, a payment changed, and the online registration that started it.
 * Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Box } from '@mantine/core';

import { HistoryList } from '../HistoryList';
import { ENTRIES, LOOKUPS, TITLES } from './entries';

export const Registration: Story = () => (
  <Box p="md" maw={720}>
    <HistoryList entries={ENTRIES} options={{ titles: TITLES, lookups: LOOKUPS }} />
  </Box>
);

export const Empty: Story = () => (
  <Box p="md" maw={720}>
    <HistoryList entries={[]} />
  </Box>
);
