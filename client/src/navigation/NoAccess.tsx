/**
 * Shown to a signed-in user without a Camphoric permission group (SPEC §6):
 * they can't use the admin until an Admin gives them one.
 */

import { Button, Card, Center, Stack, Text, Title } from '@mantine/core';
import type { ApiUser } from 'api-types';
import { useLogout } from 'hooks/auth';

export function NoAccess({ user }: { user: ApiUser }) {
  const logout = useLogout();
  return (
    <Center mih="100vh" p="md">
      <Card withBorder padding="lg" w={420} maw="100%">
        <Stack>
          <Title order={3}>No access yet</Title>
          <Text>
            You're signed in as <b>{user.username}</b>, but your account doesn't have access to the
            Camphoric admin. Ask an administrator to give you a permission group.
          </Text>
          <Button variant="default" onClick={() => logout.mutate()} loading={logout.isPending}>
            Sign out
          </Button>
        </Stack>
      </Card>
    </Center>
  );
}
