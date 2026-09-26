/**
 * Ladle stories for the user menu (SPEC §6, §8.2): who's signed in and their
 * Camphoric permission group, for each group. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Group } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { anonymousUser, type ApiUser, type Role } from 'api-types';
import { WHOAMI_KEY } from 'hooks/auth';
import { useState } from 'react';

import { NoAccess } from '../NoAccess';
import { UserMenu } from '../UserMenu';

/** A query client that already knows who's signed in. */
function signedInClient(user: ApiUser) {
  const client = new QueryClient();
  client.setQueryData(WHOAMI_KEY, user);
  return client;
}

function Signed({ userRole, name }: { userRole: Role | null; name: [string, string] }) {
  const user = {
    ...anonymousUser,
    id: 3,
    username: 'pat',
    first_name: name[0],
    last_name: name[1],
    is_active: true,
    role: userRole,
  };
  const [client] = useState(() => signedInClient(user));
  return (
    <QueryClientProvider client={client}>
      <Group p="md" justify="flex-end" maw={600}>
        <UserMenu />
      </Group>
    </QueryClientProvider>
  );
}

export const Admin: Story = () => <Signed userRole="admin" name={['Pat', 'Alpha']} />;
export const Registrar: Story = () => <Signed userRole="registrar" name={['Sam', 'Beta']} />;
export const Reporter: Story = () => <Signed userRole="reporter" name={['', '']} />;

export const WithoutAccess: Story = () => {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <NoAccess user={{ ...anonymousUser, id: 4, username: 'kim', is_active: true }} />
    </QueryClientProvider>
  );
};
