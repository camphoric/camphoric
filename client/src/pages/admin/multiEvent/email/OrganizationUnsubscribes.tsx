/**
 * Who unsubscribed from an organization's email to past campers (SPEC §8.12;
 * §15 DR-182): each address, how (an email's unsubscribe link, or added by an
 * organizer) and when. It's for the organization's email to past campers,
 * events made later included; an event's group email has its own list. An
 * organizer can add an address or remove one, after confirming.
 */

import { ActionIcon, Button, Group, Stack, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';
import type { ApiOrganizationUnsubscribe } from 'api-types';
import { confirmDelete } from 'components/ConfirmDelete';
import { InlineLoading } from 'components/Loading';
import { CanEdit } from 'hooks/permissions';
import { useState } from 'react';
import { organizationUnsubscribeHooks } from 'store/entities';
import { apiErrorMessage } from 'utils/fetch';

import { formatTime } from '../../email/emailLabels';
import { sourceLabel } from '../../email/EmailUnsubscribes';

export function OrganizationUnsubscribes({ organizationId }: { organizationId: number }) {
  const { data: rows } = organizationUnsubscribeHooks.useList({ organization: organizationId });
  const remove = organizationUnsubscribeHooks.useDelete();
  const add = organizationUnsubscribeHooks.useCreate();
  const [address, setAddress] = useState('');

  const submit = () =>
    add.mutate(
      { organization: organizationId, email: address.trim() } as Parameters<typeof add.mutate>[0],
      {
        onSuccess: (row) => {
          setAddress('');
          notifications.show({ color: 'green', message: `${row.email} is unsubscribed` });
        },
      },
    );

  const confirmRemove = (row: ApiOrganizationUnsubscribe) =>
    confirmDelete({
      path: 'organization-unsubscribes',
      id: row.id,
      title: 'Remove from the list?',
      message: <>{row.email} will get the organization’s emails to past campers again.</>,
      confirmLabel: 'Remove',
      onConfirm: () =>
        remove.mutate(
          { id: row.id, version: row.version },
          {
            onError: (error) =>
              notifications.show({ color: 'red', message: apiErrorMessage(error) }),
          },
        ),
    });

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        These addresses don’t get the organization’s emails to past campers: they followed the
        unsubscribe link at the bottom of one, or an organizer added them. Someone unsubscribed from
        an included event’s group email is left out too. Confirmations and invitations still reach
        them.
      </Text>

      <CanEdit>
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
      </CanEdit>

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
                    <CanEdit>
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
                    </CanEdit>
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
