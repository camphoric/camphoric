/**
 * Stories for a personal access token just made (SPEC §6; #965): the whole
 * token, shown once, to copy; and a read-only one. Run `npm run storybook`.
 */

import { Code, Paper, Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { useState } from 'react';

import { NewTokenSecret } from '../NewTokenSecret';
import { SAMPLE_NEW_TOKEN } from './tokens';

function Harness({ readOnly }: { readOnly: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <Stack p="md" maw={560}>
      <Paper withBorder p="md">
        <NewTokenSecret
          token={{ ...SAMPLE_NEW_TOKEN, read_only: readOnly }}
          onDone={() => setDone(true)}
        />
      </Paper>
      {done && <Code data-testid="done">Done</Code>}
    </Stack>
  );
}

export default { title: 'New Token Secret' } satisfies Meta;

export const JustMade: StoryFn = () => <Harness readOnly={false} />;
export const ReadOnly: StoryFn = () => <Harness readOnly />;
