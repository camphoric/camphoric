/**
 * Stories for the email account form (SPEC §8.8): adding an account,
 * editing one (its password kept unless re-entered), and one whose stored
 * password can no longer be read. Submitting shows what would be saved.
 * Run `npm run storybook`.
 */

import { Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { useState } from 'react';

import { type EmailAccountBody, EmailAccountForm } from '../EmailAccountForm';
import { sampleAccount } from './emailAccountFixtures';

function Harness({ account }: { account?: Parameters<typeof EmailAccountForm>[0]['account'] }) {
  const [saved, setSaved] = useState<EmailAccountBody>();
  return (
    <Stack maw={640}>
      <EmailAccountForm
        organizationId={1}
        account={account}
        onSubmit={setSaved}
        onCancel={() => setSaved(undefined)}
      />
      {saved && <pre>{JSON.stringify(saved, null, 2)}</pre>}
    </Stack>
  );
}

export default { title: 'Email Account Form' } satisfies Meta;

export const New: StoryFn = () => <Harness />;

export const Editing: StoryFn = () => <Harness account={sampleAccount()} />;

export const UnreadablePassword: StoryFn = () => (
  <Harness account={sampleAccount({ password_status: 'unreadable' })} />
);
