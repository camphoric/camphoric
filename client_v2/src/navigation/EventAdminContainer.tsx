/**
 * Event Admin shell (SPEC §8.2). Hosts the admin sections, indicating the
 * current one and showing event/organization identity. Sections are addressable
 * at …/event/:eventId/<section> so they're linkable; an unknown subpath falls
 * back to home (handled in the router).
 *
 * The header names the event, links back to the event chooser, and carries the
 * light/dark toggle (§9.6), the user menu and a "Read-only" badge for a user who can view but not change (a
 * Reporter; DR-51).
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
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconArrowLeft,
  IconBed,
  IconFileText,
  IconHelp,
  IconHome,
  IconMail,
  IconReportAnalytics,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react';
import { Link, Outlet, useParams } from '@tanstack/react-router';
import { ColorSchemeToggle } from 'components/ColorSchemeToggle';
import { usePermissions } from 'hooks/permissions';
import { UserMenu } from 'navigation/UserMenu';
import type { ReactNode } from 'react';
import { eventHooks } from 'store/entities';

const SECTIONS = [
  { path: 'home', label: 'Home', icon: IconHome },
  { path: 'registrations', label: 'Registrations', icon: IconFileText },
  { path: 'campers', label: 'Campers', icon: IconUsers },
  { path: 'lodging', label: 'Lodging', icon: IconBed },
  { path: 'reports', label: 'Reports', icon: IconReportAnalytics },
  { path: 'email', label: 'Email', icon: IconMail },
  { path: 'template-help', label: 'Template help', icon: IconHelp },
  { path: 'settings', label: 'Settings', icon: IconSettings },
] as const;

export function EventAdminContainer() {
  const { organizationId, eventId } = useParams({ strict: false });
  const [opened, { toggle }] = useDisclosure();
  const { canEdit } = usePermissions();
  const { data: event } = eventHooks.useById(eventId);

  const base = `/admin/organization/${organizationId}/event/${eventId}`;

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group wrap="nowrap" style={{ minWidth: 0 }}>
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
            <Title order={4} style={{ whiteSpace: 'nowrap' }}>
              Camphoric Admin
            </Title>
            {event && (
              <Text fw={500} c="dimmed" truncate>
                {event.name}
              </Text>
            )}
            {!canEdit && (
              <Badge
                variant="light"
                color="gray"
                title="Your permission group can view but not change"
              >
                Read-only
              </Badge>
            )}
          </Group>
          <Group gap="xs" wrap="nowrap">
            <ColorSchemeToggle />
            <UserMenu />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <ScrollArea>
          {SECTIONS.map(({ path, label, icon: Icon }) => (
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

/** Wrapper used by the admin chooser routes that don't need the event shell. */
export function AdminPage({ children }: { children: ReactNode }) {
  return <div style={{ padding: 'var(--mantine-spacing-lg)' }}>{children}</div>;
}
