/**
 * Event Admin shell (SPEC §8.2). Hosts the admin sections, indicating the
 * current one and showing event/organization identity. Sections are addressable
 * at …/event/:eventId/<section> so they're linkable; an unknown subpath falls
 * back to home (handled in the router).
 *
 * Phase 1 provides the navigation chrome + logout; the sections themselves are
 * placeholders until their phases (§8.3–§8.8).
 */

import { AppShell, Burger, Button, Group, NavLink, ScrollArea, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBed,
  IconFileText,
  IconHome,
  IconReportAnalytics,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react';
import { Link, Outlet, useParams } from '@tanstack/react-router';
import { useLogout } from 'hooks/auth';
import type { ReactNode } from 'react';

const SECTIONS = [
  { path: 'home', label: 'Home', icon: IconHome },
  { path: 'registrations', label: 'Registrations', icon: IconFileText },
  { path: 'campers', label: 'Campers', icon: IconUsers },
  { path: 'lodging', label: 'Lodging', icon: IconBed },
  { path: 'reports', label: 'Reports', icon: IconReportAnalytics },
  { path: 'settings', label: 'Settings', icon: IconSettings },
] as const;

export function EventAdminContainer() {
  const { organizationId, eventId } = useParams({ strict: false });
  const [opened, { toggle }] = useDisclosure();
  const logout = useLogout();

  const base = `/admin/organization/${organizationId}/event/${eventId}`;

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={4}>Camphoric Admin</Title>
          </Group>
          <Button variant="subtle" size="xs" onClick={() => logout.mutate()}>
            Sign out
          </Button>
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
