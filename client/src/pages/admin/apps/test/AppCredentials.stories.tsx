/**
 * Stories for an app's setup details (SPEC §8.10): right after it's registered,
 * with its secret shown once, and later, without it. Run `npm run storybook`.
 */

import { Paper } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { AppCredentials } from '../AppCredentials';

const ORIGIN = 'https://camp.example.org';

export default { title: 'App Credentials' } satisfies Meta;

export const JustRegistered: StoryFn = () => (
  <Paper withBorder p="md" m="md" maw={640}>
    <AppCredentials
      clientId="Xk3vQ8bLr2yT0pWm6fN1aCq9"
      clientSecret="s3cr3t-only-shown-once-9f8e7d6c5b4a"
      origin={ORIGIN}
    />
  </Paper>
);
export const Later: StoryFn = () => (
  <Paper withBorder p="md" m="md" maw={640}>
    <AppCredentials clientId="Xk3vQ8bLr2yT0pWm6fN1aCq9" origin={ORIGIN} />
  </Paper>
);
