/**
 * Email (SPEC §8.9): the event's bulk emails, newest first, with their status
 * — select one (URL-addressable via `?emailTaskId`) to see its progress and
 * send it, or compose a new one.
 */

import { Badge, Button, Card, Grid, Group, Stack, Text, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconPlus } from '@tabler/icons-react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { InlineLoading } from 'components/Loading';
import { useState } from 'react';
import { useBulkEmailTask } from 'store/bulkEmail';
import { bulkEmailTaskHooks, eventHooks } from 'store/entities';

import { BulkEmailComposer } from './BulkEmailComposer';
import { BulkEmailTaskView, STATUS_COLOR, STATUS_LABEL } from './BulkEmailTaskView';

const FROM = '/admin/organization/$organizationId/event/$eventId';

type Mode = 'view' | 'edit' | 'create';

export function EventAdminEmail() {
  const { organizationId, eventId } = useParams({ from: FROM });
  const { emailTaskId } = useSearch({ from: FROM });
  const navigate = useNavigate();
  const { data: event } = eventHooks.useById(eventId);
  const { data: tasks } = bulkEmailTaskHooks.useList({ event: eventId });
  const selectedId = emailTaskId ? Number(emailTaskId) : undefined;
  const { data: selected } = useBulkEmailTask(selectedId);
  const del = bulkEmailTaskHooks.useDelete();
  const [mode, setMode] = useState<Mode>('view');

  const helpBase = `/admin/organization/${organizationId}/event/${eventId}/template-help`;

  const select = (id?: number) => {
    setMode('view');
    void navigate({
      to: '/admin/organization/$organizationId/event/$eventId/email',
      params: { organizationId, eventId },
      search: (prev) => ({ ...prev, emailTaskId: id ? String(id) : undefined }),
    });
  };

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
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            select(undefined);
            setMode('create');
          }}
        >
          New email
        </Button>
      </Group>

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
                    <Badge size="xs" variant="light" color={STATUS_COLOR[task.status ?? 'draft']}>
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
    </Stack>
  );
}
