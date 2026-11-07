/**
 * Stories for making a personal access token (SPEC §6; #965): with no cap on
 * how long it lasts (so "never" is offered), with the server's cap, and one the
 * server refused. What would be sent is shown under the form (the expiry as
 * days from now; null for never). Run `npm run storybook`.
 */

import { Code, Paper, Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import type { NewTokenRequest } from 'api-types';
import { useState } from 'react';
import { ApiError } from 'utils/fetch';

import { NewTokenForm } from '../NewTokenForm';

/** What was sent, with the expiry as whole days from now so it reads the same any day. */
function describeSent({ expires_at, ...rest }: NewTokenRequest) {
  const days =
    expires_at === null
      ? null
      : Math.round((new Date(expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return JSON.stringify({ ...rest, expires_in_days: days });
}

function Harness({ maxDays, error }: { maxDays: number | null; error?: unknown }) {
  const [sent, setSent] = useState<NewTokenRequest | null>(null);
  return (
    <Stack p="md" maw={560}>
      <Paper withBorder p="md">
        <NewTokenForm
          maxDays={maxDays}
          error={error}
          onSubmit={setSent}
          onCancel={() => setSent(null)}
        />
      </Paper>
      {sent && <Code data-testid="sent">{describeSent(sent)}</Code>}
    </Stack>
  );
}

export default { title: 'New Token Form' } satisfies Meta;

export const NoCap: StoryFn = () => <Harness maxDays={null} />;
export const Capped: StoryFn = () => <Harness maxDays={30} />;
export const Refused: StoryFn = () => (
  <Harness
    maxDays={null}
    error={
      new ApiError(400, 'Bad Request', {
        expires_at: ['Choose a time that’s still to come.'],
      })
    }
  />
);
