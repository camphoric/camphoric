/**
 * Email (SPEC §8.9): what the event's email is doing now (the queue, and a
 * warning when nothing is sending it), then two tabs (`?emailTab`):
 * - Bulk email: the event's bulk emails, newest first, with their status —
 *   select one (`?emailTaskId`) to see its progress and send it, or compose a
 *   new one.
 * - History: every email the event has sent or queued (`?messageId` opens one;
 *   the filters are `?mstatus`, `?mkind`, `?mq`, `?mpage`).
 */

import { Badge, Button, Card, Grid, Group, Stack, Tabs, Text, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconPlus } from '@tabler/icons-react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { InlineLoading } from 'components/Loading';
import { useState } from 'react';
import { useBulkEmailTask } from 'store/bulkEmail';
import { type EmailHistoryFilters, useEmailQueue } from 'store/email';
import { bulkEmailTaskHooks, eventHooks } from 'store/entities';

import { BulkEmailComposer } from './BulkEmailComposer';
import { BulkEmailTaskView, STATUS_COLOR, STATUS_LABEL } from './BulkEmailTaskView';
import { EmailHistory } from './EmailHistory';
import { QueueStatus } from './QueueStatus';

const FROM = '/admin/organization/$organizationId/event/$eventId';

type Mode = 'view' | 'edit' | 'create';

export function EventAdminEmail() {
  const { organizationId, eventId } = useParams({ from: FROM });
  const search = useSearch({ from: FROM });
  const { emailTaskId, emailTab = 'bulk', messageId } = search;
  const navigate = useNavigate();
  const { data: queue } = useEmailQueue(eventId);
  const { data: event } = eventHooks.useById(eventId);
  const { data: tasks } = bulkEmailTaskHooks.useList({ event: eventId });
  const selectedId = emailTaskId ? Number(emailTaskId) : undefined;
  const { data: selected } = useBulkEmailTask(selectedId);
  const del = bulkEmailTaskHooks.useDelete();
  const [mode, setMode] = useState<Mode>('view');

  const helpBase = `/admin/organization/${organizationId}/event/${eventId}/template-help`;

  const setSearch = (patch: Record<string, string | undefined>) =>
    void navigate({
      to: '/admin/organization/$organizationId/event/$eventId/email',
      params: { organizationId, eventId },
      search: (prev) => ({ ...prev, ...patch }),
    });

  const select = (id?: number) => {
    setMode('view');
    setSearch({ emailTaskId: id ? String(id) : undefined });
  };

  const historyFilters: EmailHistoryFilters = {
    status: search.mstatus,
    kind: search.mkind,
    q: search.mq,
    page: search.mpage ? Number(search.mpage) : undefined,
  };
  const setHistoryFilters = (filters: EmailHistoryFilters) =>
    setSearch({
      mstatus: filters.status || undefined,
      mkind: filters.kind || undefined,
      mq: filters.q || undefined,
      mpage: filters.page && filters.page > 1 ? String(filters.page) : undefined,
    });

  const confirmDelete = () => {
    if (!selected) return;
    modals.openConfirmModal({
      title: 'Delete email',
      children: <Text>Delete “{selected.subject}” and its recipient list?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => del.mutate({ id: selected.id }, { onSuccess: () => select(undefined) }),
    });
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Email</Title>
        {emailTab === 'bulk' && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              select(undefined);
              setMode('create');
            }}
          >
            New email
          </Button>
        )}
      </Group>

      {queue && <QueueStatus state={queue} />}

      <Tabs
        value={emailTab}
        onChange={(tab) => setSearch({ emailTab: tab === 'history' ? 'history' : undefined })}
      >
        <Tabs.List>
          <Tabs.Tab value="bulk">Bulk email</Tabs.Tab>
          <Tabs.Tab value="history">History</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="history" pt="md">
          <EmailHistory
            eventId={eventId}
            queue={queue}
            filters={historyFilters}
            onFiltersChange={setHistoryFilters}
            messageId={messageId ? Number(messageId) : undefined}
            onOpenMessage={(id) => setSearch({ messageId: id ? String(id) : undefined })}
          />
        </Tabs.Panel>

        <Tabs.Panel value="bulk" pt="md">
          <Grid>
            <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
              <Stack gap="xs">
                {tasks?.length ? (
                  tasks.map((task) => (
                    <Button
                      key={task.id}
                      variant={selectedId === task.id && mode !== 'create' ? 'light' : 'subtle'}
                      justify="space-between"
                      rightSection={
                        <Badge
                          size="xs"
                          variant="light"
                          color={STATUS_COLOR[task.status ?? 'draft']}
                        >
                          {STATUS_LABEL[task.status ?? 'draft']}
                        </Badge>
                      }
                      onClick={() => select(task.id)}
                      styles={{ label: { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                    >
                      {task.subject}
                    </Button>
                  ))
                ) : (
                  <Text c="dimmed" size="sm">
                    No emails yet.
                  </Text>
                )}
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 8, md: 9 }}>
              {mode === 'create' && event && (
                <Card withBorder>
                  <BulkEmailComposer
                    eventId={eventId}
                    defaultFrom={event.confirmation_email_from}
                    helpBase={helpBase}
                    onDone={(id) => select(id)}
                  />
                </Card>
              )}

              {mode === 'edit' && selected && event && (
                <Card withBorder>
                  <BulkEmailComposer
                    eventId={eventId}
                    defaultFrom={event.confirmation_email_from}
                    task={selected}
                    helpBase={helpBase}
                    onDone={() => setMode('view')}
                  />
                </Card>
              )}

              {mode === 'view' && selectedId !== undefined && !selected && (
                <InlineLoading message="Loading email…" />
              )}

              {mode === 'view' && selected && (
                <BulkEmailTaskView
                  task={selected}
                  onEdit={() => setMode('edit')}
                  onDelete={confirmDelete}
                />
              )}

              {mode === 'view' && selectedId === undefined && (
                <Text c="dimmed">Select an email, or compose a new one.</Text>
              )}
            </Grid.Col>
          </Grid>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
