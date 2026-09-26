/**
 * Ladle stories for the email account form (SPEC §8.8): adding an account,
 * editing one (its password kept unless re-entered), and one whose stored
 * password can no longer be read. Submitting shows what would be saved.
 * Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Stack } from '@mantine/core';
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

export const New: Story = () => <Harness />;

export const Editing: Story = () => <Harness account={sampleAccount()} />;

export const UnreadablePassword: Story = () => (
  <Harness account={sampleAccount({ password_status: 'unreadable' })} />
);
