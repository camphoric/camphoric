/**
 * Special / invitation-based registration (SPEC §8.4): invite a special
 * registration and track the event's invitations. (Registration types
 * themselves are managed in Settings — §8.8, §15 DR-32.)
 *
 * The invitations table (newest first) shows name, email, type, derived status
 * (redeemed → has a registration; otherwise how its latest email is doing:
 * sending, sent, failed or not sent — §15 DR-43; else unsent), and a link to
 * the linked registration when redeemed, with per-row resend/delete. While an
 * invitation's email is on its way, the list refreshes every couple of seconds.
 * Rendered as the "Invitations" tab of the section.
 */

import { Anchor, Badge, Button, Group, Stack, Text, Title, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconMail, IconPlus, IconTrash } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import type { ApiInvitation } from 'api-types';
import { DataTable } from 'components/DataTable';
import { FullScreenLoading } from 'components/Loading';
import { useRegistrationTypeLookup } from 'hooks/useAdminData';
import { useEffect, useMemo, useState } from 'react';
import { invitationHooks, registrationTypeHooks } from 'store/entities';
import { useSendInvitation } from 'store/invitations';
import { tableStateFromSearch, tableStateToSearch } from 'utils/tableUrlState';

import { InviteForm } from './InviteForm';

const FROM = '/admin/organization/$organizationId/event/$eventId';

export type InvitationStatus = 'Redeemed' | 'Sending' | 'Sent' | 'Failed' | 'Not sent' | 'Unsent';

export function invitationStatus(i: ApiInvitation): InvitationStatus {
  if (i.registration != null) return 'Redeemed';
  switch (i.email?.status) {
    case 'queued':
    case 'sending':
      return 'Sending';
    case 'sent':
      return 'Sent';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Not sent';
  }
  // Sent before email was queued (no message on record).
  if (i.sent_time) return 'Sent';
  return 'Unsent';
}

const STATUS_COLOR: Record<InvitationStatus, string> = {
  Redeemed: 'green',
  Sending: 'blue',
  Sent: 'blue',
  Failed: 'red',
  'Not sent': 'gray',
  Unsent: 'gray',
};

/** How often the list refreshes while an invitation's email is on its way. */
const SENDING_POLL_MS = 2000;

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
  const client = useQueryClient();

  // Follow an invitation email until it's sent (or fails).
  const sending = (invitations ?? []).some((i) => invitationStatus(i) === 'Sending');
  useEffect(() => {
    if (!sending) return;
    const timer = setInterval(
      () => void client.invalidateQueries({ queryKey: ['Invitation'] }),
      SENDING_POLL_MS,
    );
    return () => clearInterval(timer);
  }, [sending, client]);

  const [inviteOpen, setInviteOpen] = useState(false);

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
          const badge = <Badge color={STATUS_COLOR[status]}>{status}</Badge>;
          const error = info.row.original.email?.error;
          return (status === 'Failed' || status === 'Not sent') && error ? (
            <Tooltip label={error} multiline maw={360}>
              {badge}
            </Tooltip>
          ) : (
            badge
          );
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

      {registrationTypes.length === 0 && (
        <Text c="dimmed" size="sm">
          No registration types yet. Add them in Settings to invite special registrations.
        </Text>
      )}

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
    </Stack>
  );
}
