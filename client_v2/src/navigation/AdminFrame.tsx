/**
 * The site-level admin frame (SPEC §8.1): a header with the Camphoric title and
 * the user menu, around the organization and event choosers. On the event
 * chooser, a back arrow left of the title returns to organization selection —
 * where the event admin's header has its own way back.
 */

import { ActionIcon, Anchor, AppShell, Group, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { Link, Outlet, useMatch } from '@tanstack/react-router';
import { UserMenu } from 'navigation/UserMenu';

export function AdminFrame() {
  const choosingEvent = useMatch({
    from: '/admin/frame/organization/$organizationId/event',
    shouldThrow: false,
  });
  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            {choosingEvent && (
              <ActionIcon
                component={Link}
                to="/admin/organization"
                variant="subtle"
                color="gray"
                aria-label="Back to organization selection"
                title="Back to organization selection"
              >
                <IconArrowLeft size={18} />
              </ActionIcon>
            )}
            <Anchor component={Link} to="/admin" underline="never" c="inherit">
              <Title order={4}>Camphoric Admin</Title>
            </Anchor>
          </Group>
          <UserMenu />
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
