/**
 * The site-level admin frame (SPEC §8.1): a header with the Camphoric title, the
 * server's version (where the event admin shows the event's name), the
 * light/dark toggle (§9.6) and the user menu, around the organization and event
 * choosers. On the event chooser, a back arrow left of the title returns to
 * organization selection — where the event admin's header has its own way back.
 */

import { ActionIcon, Anchor, AppShell, Group, Text, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { Link, Outlet, useMatch } from '@tanstack/react-router';
import { ColorSchemeToggle } from 'components/ColorSchemeToggle';
import { UserMenu } from 'navigation/UserMenu';
import { formatVersion, useServerVersion } from 'store/version';

export function AdminFrame() {
  const choosingEvent = useMatch({
    from: '/admin/frame/organization/$organizationId/event',
    shouldThrow: false,
  });
  const version = useServerVersion();
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
            {!version.isPending && (
              <Text fw={500} c="dimmed" truncate>
                {formatVersion(version.data?.version)}
              </Text>
            )}
          </Group>
          <Group gap="xs" wrap="nowrap">
            <ColorSchemeToggle />
            <UserMenu />
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
