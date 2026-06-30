/**
 * Registrations section (SPEC §8.4). Two tabs, the active one URL-addressable via
 * `?registrationsTab`: "Registrations" (the list + editor) and "Invitations"
 * (special/invitation-based registration and registration types).
 */

import { Stack, Tabs, Title } from '@mantine/core';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';

import { InvitationsPanel } from './InvitationsPanel';
import { RegistrationsList } from './RegistrationsList';

const FROM = '/admin/organization/$organizationId/event/$eventId';

export function EventAdminRegistrations() {
  const { organizationId, eventId } = useParams({ from: FROM });
  const { registrationsTab } = useSearch({ from: FROM });
  const navigate = useNavigate();

  const tab = registrationsTab === 'invitations' ? 'invitations' : 'registrations';

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
        </Tabs.List>
        <Tabs.Panel value="registrations">
          <RegistrationsList />
        </Tabs.Panel>
        <Tabs.Panel value="invitations">
          <InvitationsPanel />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
