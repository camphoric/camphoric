/**
 * Who unsubscribed from the event's group email (SPEC §8.9; §15 DR-48): each
 * address, how (an email's unsubscribe link, or added by an organizer) and
 * when. Group email skips them; confirmations and invitations still reach
 * them. An organizer can add an address (someone who asked by reply) or remove
 * one, after confirming.
 */

import { ActionIcon, Button, Group, Stack, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';
import type { ApiEmailUnsubscribe } from 'api-types';
import { InlineLoading } from 'components/Loading';
import { useState } from 'react';
import { emailUnsubscribeHooks } from 'store/entities';
import { useAddUnsubscribe } from 'store/groupEmail';
import { apiErrorMessage } from 'utils/fetch';

import { formatTime } from './emailLabels';

export function sourceLabel(row: ApiEmailUnsubscribe) {
  if (row.source === 'link') return 'Unsubscribe link';
  return row.created_by_name ? `Added by ${row.created_by_name}` : 'Added by an organizer';
}

export function EmailUnsubscribes({ eventId }: { eventId: number }) {
  const { data: rows } = emailUnsubscribeHooks.useList({ event: eventId });
  const remove = emailUnsubscribeHooks.useDelete();
  const add = useAddUnsubscribe();
  const [address, setAddress] = useState('');

  const submit = () =>
    add.mutate(
      { eventId, email: address.trim() },
      {
        onSuccess: (row) => {
          setAddress('');
          notifications.show({ color: 'green', message: `${row.email} is unsubscribed` });
        },
      },
    );

  const confirmRemove = (row: ApiEmailUnsubscribe) =>
    modals.openConfirmModal({
      title: 'Remove from the list?',
      children: <Text size="sm">{row.email} will get this event’s group emails again.</Text>,
      labels: { confirm: 'Remove', cancel: 'Cancel' },
      onConfirm: () =>
        remove.mutate(
          { id: row.id },
          {
            onError: (error) =>
              notifications.show({ color: 'red', message: apiErrorMessage(error) }),
          },
        ),
    });

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        These addresses don’t get this event’s group emails: they followed the unsubscribe link at
        the bottom of one, or an organizer added them. Confirmations and invitations still reach
        them.
      </Text>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Group align="flex-start" gap="xs">
          <TextInput
            aria-label="Address to unsubscribe"
            placeholder="someone@example.com"
            value={address}
            onChange={(e) => setAddress(e.currentTarget.value)}
            error={add.error ? apiErrorMessage(add.error).replace(/^email: /, '') : undefined}
            w={300}
          />
          <Button type="submit" disabled={!address.trim()} loading={add.isPending}>
            Unsubscribe address
          </Button>
        </Group>
      </form>

      {!rows ? (
        <InlineLoading message="Loading…" />
      ) : rows.length ? (
        <Table.ScrollContainer minWidth={520}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Address</Table.Th>
                <Table.Th>How</Table.Th>
                <Table.Th>When</Table.Th>
                <Table.Th aria-label="Actions" />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>{row.email}</Table.Td>
                  <Table.Td>{sourceLabel(row)}</Table.Td>
                  <Table.Td>{formatTime(row.created_at)}</Table.Td>
                  <Table.Td>
                    <Tooltip label="Remove from the list">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={`Remove ${row.email}`}
                        onClick={() => confirmRemove(row)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      ) : (
        <Text size="sm" c="dimmed">
          No one has unsubscribed.
        </Text>
      )}
    </Stack>
  );
}
