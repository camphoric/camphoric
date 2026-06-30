/**
 * Special / invitation-based registration (SPEC §8.4): invite a special
 * registration, manage registration types, and track the event's invitations.
 *
 * The invitations table (newest first) shows name, email, type, derived status
 * (redeemed → has a registration; sent → has a sent time; else unsent), and a
 * link to the linked registration when redeemed, with per-row resend/delete.
 * Rendered as the "Invitations" tab of the section.
 */

import { Anchor, Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconMail, IconPlus, IconTrash } from '@tabler/icons-react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import type { ApiInvitation, ApiRegistrationType } from 'api-types';
import { DataTable } from 'components/DataTable';
import { FullScreenLoading } from 'components/Loading';
import { useRegistrationTypeLookup } from 'hooks/useAdminData';
import { useMemo, useState } from 'react';
import { invitationHooks, registrationTypeHooks } from 'store/entities';
import { useSendInvitation } from 'store/invitations';
import { tableStateFromSearch, tableStateToSearch } from 'utils/tableUrlState';

import { InviteForm } from './InviteForm';
import { RegistrationTypeForm } from './RegistrationTypeForm';

const FROM = '/admin/organization/$organizationId/event/$eventId';

type InvitationStatus = 'Redeemed' | 'Sent' | 'Unsent';

function invitationStatus(i: ApiInvitation): InvitationStatus {
  if (i.registration != null) return 'Redeemed';
  if (i.sent_time) return 'Sent';
  return 'Unsent';
}

const STATUS_COLOR: Record<InvitationStatus, string> = {
  Redeemed: 'green',
  Sent: 'blue',
  Unsent: 'gray',
};

export function InvitationsPanel() {
  const { organizationId, eventId } = useParams({ from: FROM });
  const search = useSearch({ from: FROM });
  const navigate = useNavigate();

  const tableState = useMemo(() => tableStateFromSearch(search, 'inv'), [search]);
  const applyTableState = (patch: Record<string, string | undefined>) =>
    void navigate({
      to: '/admin/organization/$organizationId/event/$eventId/registrations',
      params: { organizationId, eventId },
      search: (prev) => ({ ...prev, ...patch }),
    });
  const { data: registrationTypes } = registrationTypeHooks.useList({ event: eventId });
  const registrationTypeLookup = useRegistrationTypeLookup(eventId);
  const { data: invitations } = invitationHooks.useList({ registration_type__event: eventId });
  const send = useSendInvitation();
  const del = invitationHooks.useDelete();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [typeForm, setTypeForm] = useState<{ open: boolean; regType?: ApiRegistrationType }>({
    open: false,
  });

  const openRegistration = (registrationId: number) =>
    void navigate({
      to: '/admin/organization/$organizationId/event/$eventId/registrations',
      params: { organizationId, eventId },
      search: { registrationsTab: 'registrations', registrationId: String(registrationId) },
    });

  const confirmDelete = (i: ApiInvitation) =>
    modals.openConfirmModal({
      title: 'Delete invitation',
      children: <Text>Delete the invitation for “{i.recipient_name}”?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => del.mutate({ id: i.id }),
    });

  // Newest first.
  const rows = useMemo(
    () =>
      (invitations ?? [])
        .slice()
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
    [invitations],
  );

  const columns = useMemo<ColumnDef<ApiInvitation, unknown>[]>(
    () => [
      { accessorKey: 'recipient_name', header: 'Name' },
      { accessorKey: 'recipient_email', header: 'Email' },
      {
        id: 'type',
        header: 'Type',
        accessorFn: (i) =>
          i.registration_type == null
            ? '—'
            : (registrationTypeLookup?.[String(i.registration_type)]?.label ?? '—'),
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: invitationStatus,
        cell: (info) => {
          const status = info.getValue<InvitationStatus>();
          return <Badge color={STATUS_COLOR[status]}>{status}</Badge>;
        },
      },
      {
        id: 'registration',
        header: 'Registration',
        cell: (info) => {
          const i = info.row.original;
          return i.registration != null ? (
            <Anchor component="button" type="button" onClick={() => openRegistration(Number(i.registration))}>
              View
            </Anchor>
          ) : (
            <Text c="dimmed">—</Text>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: (info) => {
          const i = info.row.original;
          return (
            <Group gap="xs" wrap="nowrap">
              <Button
                size="compact-sm"
                variant="light"
                leftSection={<IconMail size={14} />}
                onClick={() => send.mutate(i.id)}
                loading={send.isPending && send.variables === i.id}
              >
                Resend
              </Button>
              <Button
                size="compact-sm"
                variant="light"
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={() => confirmDelete(i)}
              >
                Delete
              </Button>
            </Group>
          );
        },
      },
    ],
    // registrationTypeLookup/send close over fresh state; recompute on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registrationTypeLookup, send.isPending, send.variables],
  );

  if (!registrationTypes || !invitations) return <FullScreenLoading />;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Invitations</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setInviteOpen(true)}
          disabled={registrationTypes.length === 0}
        >
          Invite
        </Button>
      </Group>

      <Card withBorder>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text fw={600}>Registration types</Text>
            <Button
              variant="light"
              size="compact-sm"
              leftSection={<IconPlus size={14} />}
              onClick={() => setTypeForm({ open: true, regType: undefined })}
            >
              Add type
            </Button>
          </Group>
          {registrationTypes.length === 0 ? (
            <Text c="dimmed" size="sm">
              No registration types yet. Add one to invite special registrations.
            </Text>
          ) : (
            registrationTypes.map((rt) => (
              <Group key={rt.id} justify="space-between">
                <Text size="sm">
                  {rt.label} <Text span c="dimmed">({rt.name})</Text>
                </Text>
                <Button
                  variant="subtle"
                  size="compact-sm"
                  onClick={() => setTypeForm({ open: true, regType: rt })}
                >
                  Edit
                </Button>
              </Group>
            ))
          )}
        </Stack>
      </Card>

      <DataTable
        data={rows}
        columns={columns}
        searchKeys={['recipient_name', 'recipient_email']}
        searchPlaceholder="Search invitations…"
        emptyMessage="No invitations yet."
        state={tableState}
        onStateChange={(next) => applyTableState(tableStateToSearch(next, 'inv'))}
      />

      <InviteForm
        registrationTypes={registrationTypes}
        opened={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />
      <RegistrationTypeForm
        key={typeForm.regType?.id ?? 'new'}
        eventId={eventId}
        regType={typeForm.regType}
        opened={typeForm.open}
        onClose={() => setTypeForm({ open: false })}
      />
    </Stack>
  );
}
