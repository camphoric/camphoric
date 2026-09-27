/**
 * Registrations section (SPEC §8.4). Tabs, the active one URL-addressable via
 * `?registrationsTab`: "Registrations" (the list + editor), "Invitations"
 * (special/invitation-based registration and registration types), and — for
 * Registrars and Admins — "Deleted" (restoring deleted registrations, campers and
 * payments, DR-55).
 */

import { Stack, Tabs, Title } from '@mantine/core';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { usePermissions } from 'hooks/permissions';

import { DeletedPanel } from './DeletedPanel';
import { InvitationsPanel } from './InvitationsPanel';
import { RegistrationsList } from './RegistrationsList';

const TABS = ['registrations', 'invitations', 'deleted'];

const FROM = '/admin/organization/$organizationId/event/$eventId';

export function EventAdminRegistrations() {
  const { organizationId, eventId } = useParams({ from: FROM });
  const { registrationsTab } = useSearch({ from: FROM });
  const navigate = useNavigate();
  const { canEdit } = usePermissions();

  const tab =
    TABS.includes(registrationsTab ?? '') && (registrationsTab !== 'deleted' || canEdit)
      ? registrationsTab
      : 'registrations';

  const setTab = (value: string | null) =>
    void navigate({
      to: '/admin/organization/$organizationId/event/$eventId/registrations',
      params: { organizationId, eventId },
      search: (prev) => ({ ...prev, registrationsTab: value ?? undefined }),
    });

  return (
    <Stack>
      <Title order={2}>Registrations</Title>
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="registrations">Registrations</Tabs.Tab>
          <Tabs.Tab value="invitations">Invitations</Tabs.Tab>
          {canEdit && <Tabs.Tab value="deleted">Deleted</Tabs.Tab>}
        </Tabs.List>
        <Tabs.Panel value="registrations">
          <RegistrationsList />
        </Tabs.Panel>
        <Tabs.Panel value="invitations">
          <InvitationsPanel />
        </Tabs.Panel>
        {canEdit && (
          <Tabs.Panel value="deleted">{tab === 'deleted' && <DeletedPanel />}</Tabs.Panel>
        )}
      </Tabs>
    </Stack>
  );
}
