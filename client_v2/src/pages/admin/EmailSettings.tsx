/**
 * Email settings (SPEC §8.8): which account the event sends through, and the
 * organization's email accounts — add, edit, send a test through one, delete
 * one no event uses. Sending itself is queued and shown in the Email section's
 * history (§8.9).
 */

import { Badge, Button, Group, Modal, Select, Stack, Table, Text, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconPlus, IconSend, IconTrash } from '@tabler/icons-react';
import type { ApiEmailAccount, ApiEvent } from 'api-types';
import { useState } from 'react';
import { useTestEmailAccount } from 'store/email';
import { emailAccountHooks, eventHooks } from 'store/entities';
import { apiErrorMessage } from 'utils/fetch';

import { type EmailAccountBody, EmailAccountForm, SMTP_BACKEND } from './EmailAccountForm';

/** The select's value for "no account" (the server's default mailer). */
const DEFAULT_MAILER = 'default';

const SECURITY_LABEL = { starttls: 'STARTTLS', ssl: 'SSL/TLS', none: 'no security' };

function describeServer(account: ApiEmailAccount) {
  if (account.backend !== SMTP_BACKEND) return 'The server’s log (testing)';
  return `${account.host}:${account.port}, ${SECURITY_LABEL[account.security]}`;
}

function describeLimits(account: ApiEmailAccount) {
  const limits = [
    account.max_per_minute && `${account.max_per_minute} a minute`,
    account.max_per_day && `${account.max_per_day} a day`,
  ].filter(Boolean);
  return limits.length ? limits.join(', ') : 'No limits';
}

function PasswordBadge({ account }: { account: ApiEmailAccount }) {
  if (account.backend !== SMTP_BACKEND) return null;
  if (account.password_status === 'unreadable') {
    return (
      <Badge color="red" variant="light">
        Re-enter password
      </Badge>
    );
  }
  if (account.password_status === 'unset') {
    return (
      <Badge color="gray" variant="light">
        No password
      </Badge>
    );
  }
  return null;
}

export function EmailSettings({ event }: { event: ApiEvent }) {
  const { data: accounts } = emailAccountHooks.useList({ organization: event.organization });
  const updateEvent = eventHooks.useUpdate();
  const create = emailAccountHooks.useCreate();
  const update = emailAccountHooks.useUpdate();
  const remove = emailAccountHooks.useDelete();
  const test = useTestEmailAccount();
  // The account being edited, or 'new' while adding one.
  const [editing, setEditing] = useState<ApiEmailAccount | 'new' | null>(null);

  const fail = (error: Error) =>
    notifications.show({ color: 'red', message: apiErrorMessage(error) });

  const save = (body: EmailAccountBody) => {
    const done = {
      onSuccess: () => {
        notifications.show({ color: 'green', message: 'Saved' });
        setEditing(null);
      },
      onError: fail,
    };
    if (editing === 'new') create.mutate(body as Parameters<typeof create.mutate>[0], done);
    else if (editing) update.mutate({ id: editing.id, ...body }, done);
  };

  const chooseAccount = (value: string | null) =>
    updateEvent.mutate(
      { id: event.id, email_account: value && value !== DEFAULT_MAILER ? Number(value) : null },
      {
        onSuccess: () => notifications.show({ color: 'green', message: 'Sending account saved' }),
        onError: fail,
      },
    );

  const sendTest = (account: ApiEmailAccount) =>
    test.mutate(
      { accountId: account.id },
      {
        onSuccess: (message) =>
          notifications.show({
            color: 'green',
            message: `Test queued to ${message.to}; see how it went in Email › History.`,
          }),
        onError: fail,
      },
    );

  const confirmDelete = (account: ApiEmailAccount) =>
    modals.openConfirmModal({
      title: 'Delete email account',
      children: <Text>Delete “{account.name}”?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove.mutate({ id: account.id }, { onError: fail }),
    });

  return (
    <Stack>
      <Title order={3}>Sending account</Title>
      <Select
        label="This event's email is sent through"
        description="Confirmations, invitations and bulk email all use it."
        data={[
          { value: DEFAULT_MAILER, label: 'No account: the server’s default mailer' },
          ...(accounts ?? []).map((a) => ({ value: String(a.id), label: a.name })),
        ]}
        value={event.email_account == null ? DEFAULT_MAILER : String(event.email_account)}
        onChange={chooseAccount}
        allowDeselect={false}
        maw={420}
        disabled={updateEvent.isPending}
      />

      <Group justify="space-between" mt="md">
        <Title order={3}>Email accounts</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>
          Add account
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        The organization’s accounts; any of its events can send through one.
      </Text>

      <Table.ScrollContainer minWidth={640}>
        <Table withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Server</Table.Th>
              <Table.Th>Limits</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(accounts ?? []).length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text c="dimmed" size="sm" ta="center" py="md">
                    {accounts ? 'No email accounts yet.' : 'Loading…'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              accounts!.map((account) => (
                <Table.Tr key={account.id}>
                  <Table.Td>
                    <Group gap="xs">
                      {account.name}
                      {account.id === event.email_account && (
                        <Badge variant="light">This event</Badge>
                      )}
                      <PasswordBadge account={account} />
                    </Group>
                  </Table.Td>
                  <Table.Td>{describeServer(account)}</Table.Td>
                  <Table.Td>{describeLimits(account)}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap" justify="flex-end">
                      <Button
                        size="compact-sm"
                        variant="light"
                        leftSection={<IconEdit size={14} />}
                        onClick={() => setEditing(account)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="compact-sm"
                        variant="light"
                        leftSection={<IconSend size={14} />}
                        onClick={() => sendTest(account)}
                        loading={test.isPending && test.variables?.accountId === account.id}
                      >
                        Send test
                      </Button>
                      <Button
                        size="compact-sm"
                        variant="light"
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => confirmDelete(account)}
                      >
                        Delete
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add an email account' : 'Edit email account'}
        size="lg"
      >
        {editing !== null && (
          <EmailAccountForm
            organizationId={event.organization}
            account={editing === 'new' ? undefined : editing}
            onSubmit={save}
            onCancel={() => setEditing(null)}
            saving={create.isPending || update.isPending}
          />
        )}
      </Modal>
    </Stack>
  );
}
