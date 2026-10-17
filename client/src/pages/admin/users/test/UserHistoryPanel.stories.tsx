/**
 * Stories for a user's change history (SPEC §8.10): their changes across
 * registrations, with more to load; loading; and someone who's changed
 * nothing. Run `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { ENTRIES } from 'components/History/test/entries';

import { UserHistoryPanel } from '../UserHistoryPanel';
import { sampleUser } from './userFixtures';

export default { title: 'User History Panel' } satisfies Meta;

const user = sampleUser({ first_name: 'Reggie', last_name: 'Registrar', username: 'reggie' });

export const WithMore: StoryFn = () => (
  <Box p="md" maw={520}>
    <UserHistoryPanel
      user={user}
      entries={ENTRIES}
      total={120}
      hasMore
      loadingMore={false}
      onLoadMore={() => {}}
      onClose={() => {}}
    />
  </Box>
);

export const Loading: StoryFn = () => (
  <Box p="md" maw={520}>
    <UserHistoryPanel
      user={user}
      hasMore={false}
      loadingMore={false}
      onLoadMore={() => {}}
      onClose={() => {}}
    />
  </Box>
);

export const NoChanges: StoryFn = () => (
  <Box p="md" maw={520}>
    <UserHistoryPanel
      user={sampleUser({ first_name: '', last_name: '', username: 'newbie' })}
      entries={[]}
      total={0}
      hasMore={false}
      loadingMore={false}
      onLoadMore={() => {}}
      onClose={() => {}}
    />
  </Box>
);
