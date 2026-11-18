/**
 * Stories for the Payments area's "needs attention" list (SPEC §8.11; §15,
 * DR-171): one item of each kind under its counts, as a Registrar sees it (each
 * with its action) and as a Reporter does (each opens the registration), and
 * with nothing to do. Run `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { AttentionList } from '../AttentionList';
import { ATTENTION_ITEMS } from './fixtures';

export default { title: 'Attention List' } satisfies Meta;

const noop = () => undefined;

export const EveryKind: StoryFn = () => (
  <Box p="md" maw={820}>
    <AttentionList items={ATTENTION_ITEMS} canAct onOpen={noop} />
  </Box>
);

export const ForAReporter: StoryFn = () => (
  <Box p="md" maw={820}>
    <AttentionList items={ATTENTION_ITEMS} canAct={false} onOpen={noop} />
  </Box>
);

export const NothingToDo: StoryFn = () => (
  <Box p="md" maw={820}>
    <AttentionList items={[]} canAct onOpen={noop} />
  </Box>
);
