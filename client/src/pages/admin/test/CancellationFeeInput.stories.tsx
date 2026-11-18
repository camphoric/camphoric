/**
 * Stories for the event's cancellation fee setting (SPEC §8.3; §15, DR-170):
 * none, and JsonLogic (tiers by how long before the event). Run
 * `npm run storybook`.
 */

import { Paper, Text } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { useState } from 'react';

import { CANCELLATION_FEE_EXAMPLES, CancellationFeeInput } from '../CancellationFeeInput';

function Frame({ initial }: { initial: unknown }) {
  const [value, setValue] = useState(initial);
  return (
    <Paper withBorder p="md" m="md" maw={640}>
      <CancellationFeeInput value={value} onChange={setValue} />
      <Text size="xs" c="dimmed" mt="sm" data-testid="value">
        {JSON.stringify(value)}
      </Text>
    </Paper>
  );
}

export default { title: 'Cancellation Fee Input' } satisfies Meta;

export const NoFee: StoryFn = () => <Frame initial={null} />;
export const Tiered: StoryFn = () => <Frame initial={CANCELLATION_FEE_EXAMPLES[2].logic} />;
