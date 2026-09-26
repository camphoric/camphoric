/**
 * The site-level admin frame (SPEC §8.1): a header with the Camphoric title and
 * the user menu, around the organization and event choosers.
 */

import { Anchor, AppShell, Group, Title } from '@mantine/core';
import { Link, Outlet } from '@tanstack/react-router';
import { UserMenu } from 'navigation/UserMenu';

export function AdminFrame() {
  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Anchor component={Link} to="/admin" underline="never" c="inherit">
            <Title order={4}>Camphoric Admin</Title>
          </Anchor>
          <UserMenu />
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
