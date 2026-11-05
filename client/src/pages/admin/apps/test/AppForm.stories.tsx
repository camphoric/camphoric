/**
 * Stories for registering or editing an app (SPEC §8.10): a new one, an
 * existing one, and one the server refused. What would be saved is shown under
 * the form. Run `npm run storybook`.
 */

import { Code, Paper, Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import type { ApplicationRequest } from 'api-types';
import { useState } from 'react';
import { ApiError } from 'utils/fetch';

import { AppForm } from '../AppForm';
import { sampleApp } from './appFixtures';

function Harness(props: { app?: ReturnType<typeof sampleApp>; error?: unknown }) {
  const [saved, setSaved] = useState<ApplicationRequest | null>(null);
  return (
    <Stack p="md" maw={640}>
      <Paper withBorder p="md">
        <AppForm {...props} onSubmit={setSaved} onCancel={() => setSaved(null)} />
      </Paper>
      {saved && <Code data-testid="saved">{JSON.stringify(saved)}</Code>}
    </Stack>
  );
}

export default { title: 'App Form' } satisfies Meta;

export const NewApp: StoryFn = () => <Harness />;
export const Editing: StoryFn = () => <Harness app={sampleApp()} />;
export const Refused: StoryFn = () => (
  <Harness
    app={sampleApp()}
    error={
      new ApiError(400, 'Bad Request', {
        redirect_uris: ['Redirect URI scheme is not allowed.'],
      })
    }
  />
);
