/**
 * Multi-event reports' Email section (SPEC §8.12; §15 DR-182): the
 * organization's email to past campers, in tabs (`?emailTab`):
 * - Emails: the emails (`?templateId` edits one, `new` starts one), each sent
 *   after reviewing exactly who gets it.
 * - History: every one of these emails sent or queued, and the sends
 *   (`?messageId` opens one; the filters are `?mstatus`, `?mkind`, `?mq`,
 *   `?mpage`, and `?mbatch` for one send).
 * - Unsubscribed: the addresses that don't get them.
 * Any role reads; Registrars and Admins write, send and unsubscribe (DR-51).
 */

import {
  ActionIcon,
  Anchor,
  Button,
  Group,
  Modal,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCopy, IconPlus, IconSend, IconTrash } from '@tabler/icons-react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { ApiEmailBatch, ApiOrganizationEmail } from 'api-types';
import { confirmDelete } from 'components/ConfirmDelete';
import { RecordDeleted } from 'components/EditLease';
import { InlineLoading } from 'components/Loading';
import { CanEdit, usePermissions } from 'hooks/permissions';
import { useKeptRecord } from 'hooks/useKeptRecord';
import { useState } from 'react';
import { type EmailHistoryFilters } from 'store/email';
import { organizationEmailHooks } from 'store/entities';
import { apiErrorMessage } from 'utils/fetch';

import { EmailHistory } from '../../email/EmailHistory';
import { formatTime } from '../../email/emailLabels';
import { OrganizationEmailEditor } from './OrganizationEmailEditor';
import { OrganizationSendDialog } from './OrganizationSendDialog';
import { OrganizationUnsubscribes } from './OrganizationUnsubscribes';

const FROM = '/admin/organization/$organizationId/multi-event';

function conditions(email: ApiOrganizationEmail) {
  const count = email.filter?.rules?.length ?? 0;
  return count ? `${count} ${count === 1 ? 'condition' : 'conditions'}` : 'Everyone';
}

export function MultiEventEmail() {
  const { organizationId } = useParams({ from: FROM });
  const search = useSearch({ from: FROM });
  const { emailTab = 'emails', messageId, templateId } = search;
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const { data: emails } = organizationEmailHooks.useList({ organization: organizationId });
  const del = organizationEmailHooks.useDelete();
  const duplicate = organizationEmailHooks.useCreate();
  const [sending, setSending] = useState<ApiOrganizationEmail | null>(null);
  // Kept open if someone else deletes it meanwhile, so no unsaved edit vanishes (§9.8).
  const { record: editing, deleted } = useKeptRecord(
    templateId === 'new' ? undefined : templateId,
    emails?.find((e) => String(e.id) === templateId),
  );
  const editorOpen = (templateId === 'new' && canEdit) || !!editing;

  const setSearch = (patch: Record<string, string | undefined>) =>
    void navigate({
      to: '/admin/organization/$organizationId/multi-event/email',
      params: { organizationId },
      search: (prev) => ({ ...prev, ...patch }),
    });
  const historyFilters: EmailHistoryFilters = {
    status: search.mstatus,
    kind: search.mkind,
    q: search.mq,
    page: search.mpage ? Number(search.mpage) : undefined,
    batch: search.mbatch,
  };
  const setHistoryFilters = (filters: EmailHistoryFilters) =>
    setSearch({
      mstatus: filters.status || undefined,
      mkind: filters.kind || undefined,
      mq: filters.q || undefined,
      mpage: filters.page && filters.page > 1 ? String(filters.page) : undefined,
      mbatch: filters.batch || undefined,
    });

  const onSent = (batch: ApiEmailBatch) => {
    setSending(null);
    notifications.show({
      color: 'green',
      message: batch.send_at
        ? `Scheduled for ${formatTime(batch.send_at)}`
        : `Sending to ${batch.recipient_keys.length} people`,
    });
    setSearch({ emailTab: 'history', mbatch: String(batch.id), mpage: undefined });
  };

  const confirmDeleteEmail = (email: ApiOrganizationEmail) =>
    confirmDelete({
      path: 'organization-emails',
      id: email.id,
      title: 'Delete email',
      message: <>Delete “{email.name}”? What was sent stays in the history.</>,
      onConfirm: () =>
        del.mutate(
          { id: email.id, version: email.version },
          {
            onError: (error) =>
              notifications.show({ color: 'red', message: apiErrorMessage(error) }),
          },
        ),
    });

  const copy = (email: ApiOrganizationEmail) =>
    duplicate.mutate(
      {
        organization: email.organization,
        name: `${email.name} (copy)`,
        subject: email.subject,
        body: email.body,
        from_email: email.from_email,
        reply_to: email.reply_to,
        account: email.account,
        filter: email.filter,
      },
      {
        onSuccess: (copied) => setSearch({ templateId: String(copied.id) }),
        onError: (error) => notifications.show({ color: 'red', message: apiErrorMessage(error) }),
      },
    );

  return (
    <Stack>
      <Title order={2}>Email</Title>
      <Text size="sm" c="dimmed" maw={760}>
        Email people who came to the included events — to announce next year’s registration, say, or
        to invite back everyone who came before but hasn’t registered yet.
      </Text>

      <Tabs
        value={emailTab}
        onChange={(tab) =>
          setSearch({ emailTab: tab === 'history' || tab === 'unsubscribed' ? tab : undefined })
        }
      >
        <Tabs.List>
          <Tabs.Tab value="emails">Emails</Tabs.Tab>
          <Tabs.Tab value="history">History</Tabs.Tab>
          <Tabs.Tab value="unsubscribed">Unsubscribed</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="emails" pt="md">
          {!emails ? (
            <InlineLoading message="Loading…" />
          ) : editorOpen ? (
            <Stack>
              {deleted && <RecordDeleted label="email" />}
              <OrganizationEmailEditor
                key={templateId}
                organizationId={organizationId}
                email={editing}
                onDone={() => setSearch({ templateId: undefined })}
              />
            </Stack>
          ) : (
            <Stack gap="xs">
              <Group justify="flex-end">
                <CanEdit>
                  <Button
                    leftSection={<IconPlus size={16} />}
                    onClick={() => setSearch({ templateId: 'new' })}
                  >
                    New email
                  </Button>
                </CanEdit>
              </Group>
              {emails.length ? (
                <Table.ScrollContainer minWidth={640}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Name</Table.Th>
                        <Table.Th>Subject</Table.Th>
                        <Table.Th>Recipients</Table.Th>
                        <Table.Th>Updated</Table.Th>
                        <Table.Th aria-label="Actions" />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {emails.map((email) => (
                        <Table.Tr key={email.id}>
                          <Table.Td>
                            <Anchor
                              component="button"
                              type="button"
                              onClick={() => setSearch({ templateId: String(email.id) })}
                            >
                              {email.name}
                            </Anchor>
                          </Table.Td>
                          <Table.Td>{email.subject}</Table.Td>
                          <Table.Td>{conditions(email)}</Table.Td>
                          <Table.Td>{formatTime(email.updated_at)}</Table.Td>
                          <Table.Td>
                            <CanEdit>
                              <Group gap={4} wrap="nowrap" justify="flex-end">
                                <Button
                                  size="xs"
                                  variant="light"
                                  leftSection={<IconSend size={14} />}
                                  aria-label={`Send ${email.name}`}
                                  onClick={() => setSending(email)}
                                >
                                  Send
                                </Button>
                                <Tooltip label="Duplicate">
                                  <ActionIcon
                                    variant="subtle"
                                    aria-label={`Duplicate ${email.name}`}
                                    onClick={() => copy(email)}
                                  >
                                    <IconCopy size={16} />
                                  </ActionIcon>
                                </Tooltip>
                                <Tooltip label="Delete">
                                  <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    aria-label={`Delete ${email.name}`}
                                    onClick={() => confirmDeleteEmail(email)}
                                  >
                                    <IconTrash size={16} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                            </CanEdit>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              ) : (
                <Text c="dimmed" size="sm">
                  No emails yet. An email holds a message and who it usually goes to; you review the
                  recipients each time it’s sent.
                </Text>
              )}
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="history" pt="md">
          <EmailHistory
            scope={{ organization: organizationId }}
            queue={undefined}
            filters={historyFilters}
            onFiltersChange={setHistoryFilters}
            messageId={messageId ? Number(messageId) : undefined}
            onOpenMessage={(id) => setSearch({ messageId: id ? String(id) : undefined })}
          />
        </Tabs.Panel>

        <Tabs.Panel value="unsubscribed" pt="md">
          <OrganizationUnsubscribes organizationId={Number(organizationId)} />
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={!!sending}
        onClose={() => setSending(null)}
        title={sending ? `Send “${sending.name}”` : ''}
        size="xl"
      >
        {sending && (
          <OrganizationSendDialog
            email={sending}
            onClose={() => setSending(null)}
            onSent={onSent}
          />
        )}
      </Modal>
    </Stack>
  );
}
