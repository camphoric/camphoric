/**
 * Shown in place of the admin when a superuser set this user's password and
 * asked them to change it (SPEC §6; §15 DR-52): until they choose a new one,
 * the server refuses everything else.
 */

import { Button, Card, Center, Stack, Text, Title } from '@mantine/core';
import type { ApiUser } from 'api-types';
import { useLogout } from 'hooks/auth';
import { ChangePasswordForm } from 'pages/account/ChangePasswordForm';

export function MustChangePassword({ user }: { user: ApiUser }) {
  const logout = useLogout();
  return (
    <Center mih="100vh" p="md">
      <Card withBorder padding="lg" w={420} maw="100%">
        <Stack>
          <Title order={3}>Choose a new password</Title>
          <Text size="sm">
            Your password was set for you, {user.username}. Choose your own before continuing.
          </Text>
          {/* Clearing the flag refreshes who's signed in, which shows the admin. */}
          <ChangePasswordForm onDone={() => undefined} submitLabel="Set my password" />
          <Button variant="subtle" onClick={() => logout.mutate()} loading={logout.isPending}>
            Sign out
          </Button>
        </Stack>
      </Card>
    </Center>
  );
}
