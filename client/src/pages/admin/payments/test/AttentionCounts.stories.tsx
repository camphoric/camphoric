/**
 * Stories for the "needs attention" counts (SPEC §8.11): one of each kind, a
 * few kinds, and none. Run `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { AttentionCounts } from '../AttentionCounts';
import { ATTENTION_ITEMS, NOT_INVOICED, PAST_DUE } from './fixtures';

export default { title: 'Attention Counts' } satisfies Meta;

export const EveryKind: StoryFn = () => (
  <Box p="md">
    <AttentionCounts items={ATTENTION_ITEMS} />
  </Box>
);

export const AFew: StoryFn = () => (
  <Box p="md">
    <AttentionCounts items={[NOT_INVOICED, PAST_DUE]} />
  </Box>
);

export const None: StoryFn = () => (
  <Box p="md">
    <AttentionCounts items={[]} />
  </Box>
);
