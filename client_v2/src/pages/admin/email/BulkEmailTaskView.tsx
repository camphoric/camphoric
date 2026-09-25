/**
 * One bulk email (SPEC §8.9): its status and progress, its recipients (sent,
 * waiting or failed, with the reason), and the actions — send (after
 * confirming how many it will reach), cancel, resume, send a test to
 * yourself, edit and delete. While it sends, everything refreshes every
 * couple of seconds.
 */

import {
  Badge,
  Button,
  Group,
  Modal,
  Progress,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconPlayerStop, IconSend, IconTestPipe, IconTrash } from '@tabler/icons-react';
import type { ApiBulkEmailTask, BulkEmailStatus } from 'api-types';
import { useCurrentUser } from 'hooks/auth';
import { useState } from 'react';
import {
  useBulkEmailRecipients,
  useCancelBulkEmail,
  useResolveDryRun,
  useSendBulkEmail,
  useTestBulkEmail,
} from 'store/bulkEmail';

export const STATUS_COLOR: Record<BulkEmailStatus, string> = {
  draft: 'gray',
  running: 'blue',
  finished: 'green',
  stopped: 'yellow',
  failed: 'red',
};

export const STATUS_LABEL: Record<BulkEmailStatus, string> = {
  draft: 'Draft',
  running: 'Sending',
  finished: 'Sent',
  stopped: 'Stopped',
  failed: 'Failed',
};

interface BulkEmailTaskViewProps {
  task: ApiBulkEmailTask;
  onEdit: () => void;
  onDelete: () => void;
}

function formatTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : '';
}

export function BulkEmailTaskView({ task, onEdit, onDelete }: BulkEmailTaskViewProps) {
  const status = task.status ?? 'draft';
  const sending = status === 'running';
  const { data: recipients } = useBulkEmailRecipients(task.id, sending);
  const dryRun = useResolveDryRun();
  const send = useSendBulkEmail();
  const cancel = useCancelBulkEmail();
  const test = useTestBulkEmail();
  const { data: user } = useCurrentUser();
  const [testOpen, testModal] = useDisclosure(false);
  const [testTo, setTestTo] = useState('');

  const total = task.recipient_count ?? 0;
  const sent = task.sent_count ?? 0;
  const failed = task.error_count ?? 0;
  const sendLabel =
    status === 'stopped' || status === 'failed'
      ? 'Resume…'
      : status === 'finished'
        ? 'Send to anyone new…'
        : 'Send…';

  const confirmSend = () =>
    dryRun.mutate(task.id, {
      onSuccess: (result) => {
        const counts = result.counts;
        const toSend = counts?.kept_existing
          ? total - sent
          : result.recipients.length - (counts?.already_sent ?? 0);
        if (result.diagnostics.length) {
          notifications.show({
            color: 'red',
            title: 'The recipient list can’t be built',
            message: result.diagnostics[0].message,
          });
          return;
        }
        if (toSend <= 0) {
          notifications.show({ message: 'Everyone on the list has already been sent this email.' });
          return;
        }
        modals.openConfirmModal({
          title: 'Send this email?',
          children: (
            <Stack gap="xs">
              <Text size="sm">
                “{task.subject}” will be sent to{' '}
                <strong>
                  {toSend} {toSend === 1 ? 'recipient' : 'recipients'}
                </strong>
                .
              </Text>
              {(counts?.already_sent ?? 0) > 0 && (
                <Text size="sm" c="dimmed">
                  {counts?.already_sent} already sent to won’t get it again.
                </Text>
              )}
              {result.skipped.length > 0 && (
                <Text size="sm" c="dimmed">
                  {result.skipped.length} skipped (no address, invalid, duplicate or an expression
                  failed).
                </Text>
              )}
            </Stack>
          ),
          labels: { confirm: `Send to ${toSend}`, cancel: 'Cancel' },
          onConfirm: () => send.mutate(task.id),
        });
      },
    });

  const sendTest = () => {
    test.mutate(
      { taskId: task.id, to: testTo.trim() || undefined },
      {
        onSuccess: (result) => {
          testModal.close();
          notifications.show({
            color: 'green',
            message: `Test sent to ${result.sent_to} (as ${result.rendered_for} would get it).`,
          });
        },
      },
    );
  };

  return (
    <Stack>
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Group gap="xs">
            <Title order={3}>{task.subject}</Title>
            <Badge color={STATUS_COLOR[status]} variant="light">
              {STATUS_LABEL[status]}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            From {task.from_email}
            {task.run_start_time && ` · last started ${formatTime(task.run_start_time)}`}
          </Text>
        </Stack>
        <Group gap="xs">
          <Button variant="default" onClick={onEdit} disabled={sending}>
            Edit
          </Button>
          <Button
            variant="light"
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={onDelete}
            disabled={sending}
          >
            Delete
          </Button>
        </Group>
      </Group>

      {task.error && (
        <Text size="sm" c="red">
          The last run stopped with an error: {task.error}
        </Text>
      )}

      <Group gap="xs">
        {sending ? (
          <Button
            color="red"
            variant="light"
            leftSection={<IconPlayerStop size={16} />}
            onClick={() => cancel.mutate(task.id)}
            loading={cancel.isPending}
          >
            Stop sending
          </Button>
        ) : (
          <Button
            leftSection={<IconSend size={16} />}
            onClick={confirmSend}
            loading={dryRun.isPending || send.isPending}
          >
            {sendLabel}
          </Button>
        )}
        <Button
          variant="default"
          leftSection={<IconTestPipe size={16} />}
          onClick={() => {
            setTestTo(user?.email ?? '');
            testModal.open();
          }}
        >
          Send a test…
        </Button>
      </Group>

      {total > 0 && (
        <Stack gap={4}>
          <Progress value={(sent / total) * 100} animated={sending} aria-label="Sent" size="lg" />
          <Text size="sm">
            {sent} of {total} sent
            {failed > 0 && (
              <Text span c="red" size="sm">
                {' '}
                · {failed} failed
              </Text>
            )}
          </Text>
        </Stack>
      )}

      {recipients && recipients.length > 0 ? (
        <Table.ScrollContainer minWidth={520} mah={480}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Address</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {recipients.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>{r.email}</Table.Td>
                  <Table.Td>{r.full_name}</Table.Td>
                  <Table.Td>
                    {r.sent_time ? (
                      `Sent ${formatTime(r.sent_time)}`
                    ) : r.error ? (
                      <Text span c="red" size="sm">
                        {r.error}
                      </Text>
                    ) : (
                      <Text span c="dimmed" size="sm">
                        Waiting
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      ) : (
        <Text size="sm" c="dimmed">
          The recipient list is built from the current data when the email is sent.
        </Text>
      )}

      <Modal opened={testOpen} onClose={testModal.close} title="Send a test">
        <Stack>
          <Text size="sm">
            One copy, rendered for the first recipient, with “[Test]” before the subject. Nobody on
            the list is sent anything.
          </Text>
          <TextInput
            label="Send to"
            value={testTo}
            onChange={(e) => setTestTo(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={testModal.close}>
              Cancel
            </Button>
            <Button onClick={sendTest} loading={test.isPending}>
              Send test
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
