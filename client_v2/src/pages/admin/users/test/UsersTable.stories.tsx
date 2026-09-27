/**
 * Ladle stories for the users list (SPEC §8.10): a superuser's view (with
 * Django access and Set password) and an Admin's. The last action taken is
 * shown under the table. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Code, Stack } from '@mantine/core';
import type { ApiManagedUser } from 'api-types';
import { useState } from 'react';

import { UsersTable } from '../UsersTable';
import { SAMPLE_USERS } from './userFixtures';

function Harness({ superuser }: { superuser: boolean }) {
  const [last, setLast] = useState('');
  const act = (name: string) => (user: ApiManagedUser) => setLast(`${name}: ${user.username}`);
  const users = superuser
    ? SAMPLE_USERS
    : SAMPLE_USERS.map(({ django_access: _hidden, ...user }) => user);
  return (
    <Stack p="md" maw={1000}>
      <UsersTable
        users={users}
        currentUserId={superuser ? 1 : 2}
        onEdit={act('Edit')}
        onSendLink={act('Email link')}
        onCopyLink={act('Copy link')}
        onSetPassword={superuser ? act('Set password') : undefined}
        onToggleActive={act('Toggle active')}
        onDelete={act('Delete')}
      />
      {last && <Code data-testid="last">{last}</Code>}
    </Stack>
  );
}

export const AsSuperuser: Story = () => <Harness superuser />;
export const AsAdmin: Story = () => <Harness superuser={false} />;
