/**
 * Multi-event reports shell (SPEC §8.12): an organization's data across its
 * included events, built like the Event Admin container (§8.2). Its sections
 * are addressable at …/organization/:organizationId/multi-event/<section>; an
 * unknown subpath falls back to the first (handled in the router).
 *
 * The header names the organization, links back to the event chooser, and
 * carries the "Read-only" badge for a Reporter (DR-51), the light/dark toggle
 * (§9.6) and the user menu, staying on one line on a narrow screen as the event
 * admin's does (#755).
 */

import {
  ActionIcon,
  AppShell,
  Badge,
  Burger,
  Group,
  NavLink,
  ScrollArea,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconArrowLeft,
  IconCalendarEvent,
  IconChartBar,
  IconEye,
  IconUsersGroup,
} from '@tabler/icons-react';
import { Link, Outlet, useParams } from '@tanstack/react-router';
import { ColorSchemeToggle } from 'components/ColorSchemeToggle';
import { usePermissions } from 'hooks/permissions';
import { UserMenu } from 'navigation/UserMenu';
import { organizationHooks } from 'store/entities';

const READ_ONLY_HINT = 'Your permission group can view but not change';

export const MULTI_EVENT_SECTIONS = [
  { path: 'events', label: 'Events', icon: IconCalendarEvent },
  { path: 'people', label: 'People', icon: IconUsersGroup },
  { path: 'stats', label: 'Stats', icon: IconChartBar },
] as const;

export function MultiEventContainer() {
  const { organizationId } = useParams({ strict: false });
  const [opened, { toggle }] = useDisclosure();
  const { canEdit } = usePermissions();
  const { data: organization } = organizationHooks.useById(organizationId);

  const base = `/admin/organization/${organizationId}/multi-event`;

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap" gap="xs">
          <Group wrap="nowrap" gap="sm" style={{ minWidth: 0 }}>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <ActionIcon
              component={Link}
              to={`/admin/organization/${organizationId}/event`}
              variant="subtle"
              color="gray"
              aria-label="Back to event selection"
              title="Back to event selection"
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
            <Title order={4} visibleFrom="sm" style={{ whiteSpace: 'nowrap' }}>
              Multi-event reports
            </Title>
            {organization && (
              <Text fw={500} c="dimmed" truncate style={{ minWidth: 0 }}>
                {organization.name}
              </Text>
            )}
            {!canEdit && (
              <>
                <Badge
                  variant="light"
                  color="gray"
                  title={READ_ONLY_HINT}
                  visibleFrom="sm"
                  style={{ flexShrink: 0 }}
                >
                  Read-only
                </Badge>
                <ThemeIcon
                  variant="light"
                  color="gray"
                  title={READ_ONLY_HINT}
                  aria-label="Read-only"
                  hiddenFrom="sm"
                  style={{ flexShrink: 0 }}
                >
                  <IconEye size={16} />
                </ThemeIcon>
              </>
            )}
          </Group>
          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
            <ColorSchemeToggle />
            <UserMenu />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <ScrollArea>
          {MULTI_EVENT_SECTIONS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              component={Link}
              to={`${base}/${path}`}
              label={label}
              leftSection={<Icon size={18} />}
              activeOptions={{ exact: false }}
            />
          ))}
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
