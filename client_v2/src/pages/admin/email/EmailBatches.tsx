/**
 * The event's group email sends (SPEC §8.9; §15 DR-45), newest first: which
 * template, when (or when it's scheduled), who sent it, and its progress —
 * sent, failed, not sent and still waiting, out of its copies. A send that
 * hasn't finished can be cancelled; its failed copies can be retried. Choosing
 * one shows only its copies in the history (`?mbatch`, held by the caller).
 */

import { Badge, Button, Card, Group, Progress, Stack, Text, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import type { ApiEmailBatch, EmailBatchState } from 'api-types';
import { useState } from 'react';
import { useCancelBatch, useRetryBatch } from 'store/groupEmail';
import { apiErrorMessage } from 'utils/fetch';

import { formatTime } from './emailLabels';

/** How many sends show before "Show all". */
const SHOWN = 3;

export const BATCH_STATE_LABEL: Record<EmailBatchState, string> = {
  scheduled: 'Scheduled',
  preparing: 'Preparing',
  sending: 'Sending',
  done: 'Done',
  cancelled: 'Cancelled',
};

const BATCH_STATE_COLOR: Record<EmailBatchState, string> = {
  scheduled: 'violet',
  preparing: 'blue',
  sending: 'blue',
  done: 'green',
  cancelled: 'gray',
};

interface EmailBatchesProps {
  batches: ApiEmailBatch[];
  /** The send whose copies the history shows. */
  selectedId?: number;
  onSelect: (batchId: number | undefined) => void;
}

export function EmailBatches({ batches, selectedId, onSelect }: EmailBatchesProps) {
  const [all, setAll] = useState(false);
  if (!batches.length) return null;
  const selected = batches.find((b) => b.id === selectedId);
  const first = all ? batches : batches.slice(0, SHOWN);
  // A chosen send stays in view even when it's an older one.
  const shown = selected && !first.includes(selected) ? [...first, selected] : first;

  return (
    <Stack gap="xs">
      <Text fw={600}>Group email sends</Text>
      {shown.map((batch) => (
        <BatchCard
          key={batch.id}
          batch={batch}
          selected={batch.id === selectedId}
          onSelect={() => onSelect(batch.id === selectedId ? undefined : batch.id)}
        />
      ))}
      {batches.length > SHOWN && (
        <Group>
          <Button variant="subtle" size="xs" onClick={() => setAll((a) => !a)}>
            {all ? 'Show fewer' : `Show all ${batches.length}`}
          </Button>
        </Group>
      )}
    </Stack>
  );
}

function BatchCard({
  batch,
  selected,
  onSelect,
}: {
  batch: ApiEmailBatch;
  selected: boolean;
  onSelect: () => void;
}) {
  const cancel = useCancelBatch();
  const retry = useRetryBatch();
  const { total, sent, failed, cancelled, waiting, state } = batch;
  const part = (n: number) => (total ? (n / total) * 100 : 0);
  const canCancel = state === 'scheduled' || state === 'preparing' || state === 'sending';
  const when =
    state === 'scheduled' && batch.send_at
      ? `Scheduled for ${formatTime(batch.send_at)}`
      : formatTime(batch.created_at);

  const confirmCancel = () =>
    modals.openConfirmModal({
      title: 'Cancel this send?',
      children: (
        <Text size="sm">
          {state === 'scheduled'
            ? 'Nothing is sent.'
            : `The ${waiting} ${waiting === 1 ? 'copy' : 'copies'} still waiting won’t be sent; those already sent stay sent.`}
        </Text>
      ),
      labels: { confirm: 'Cancel the send', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        cancel.mutate(batch.id, {
          onError: (error) => notifications.show({ color: 'red', message: apiErrorMessage(error) }),
        }),
    });

  const retryFailed = () =>
    retry.mutate(batch.id, {
      onSuccess: (result) =>
        notifications.show({
          color: 'green',
          message: `${result.retried} ${result.retried === 1 ? 'copy' : 'copies'} queued again`,
        }),
      onError: (error) => notifications.show({ color: 'red', message: apiErrorMessage(error) }),
    });

  return (
    <Card
      withBorder
      padding="sm"
      aria-label={`Send of ${batch.name}`}
      aria-current={selected || undefined}
      style={selected ? { borderColor: 'var(--mantine-primary-color-filled)' } : undefined}
    >
      <Stack gap={6}>
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Group gap="xs">
            <Text fw={500}>{batch.name}</Text>
            <Badge variant="light" color={BATCH_STATE_COLOR[state]}>
              {BATCH_STATE_LABEL[state]}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {when}
            {batch.created_by_name ? ` · by ${batch.created_by_name}` : ''}
          </Text>
        </Group>
        {total > 0 && (
          <Progress.Root size="lg" aria-label={`${sent} of ${total} sent`}>
            <Progress.Section value={part(sent)} color="green" />
            <Progress.Section value={part(failed)} color="red" />
            <Progress.Section value={part(cancelled)} color="gray" />
            <Progress.Section value={part(waiting)} color="blue" animated={waiting > 0} striped />
          </Progress.Root>
        )}
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Text size="sm">
            {state === 'scheduled'
              ? `${batch.recipient_keys.length} recipients chosen`
              : [
                  `${sent} of ${total} sent`,
                  failed && `${failed} failed`,
                  cancelled && `${cancelled} not sent`,
                  waiting && `${waiting} waiting`,
                  batch.skipped.length && `${batch.skipped.length} skipped`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </Text>
          <Group gap="xs">
            <Button size="xs" variant={selected ? 'filled' : 'light'} onClick={onSelect}>
              {selected ? 'Showing its emails' : 'Show its emails'}
            </Button>
            {failed > 0 && (
              <Button size="xs" variant="light" onClick={retryFailed} loading={retry.isPending}>
                Retry failed
              </Button>
            )}
            {canCancel && (
              <Tooltip label="Stop what hasn’t gone out yet">
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  onClick={confirmCancel}
                  loading={cancel.isPending}
                >
                  Cancel
                </Button>
              </Tooltip>
            )}
          </Group>
        </Group>
        {batch.error && (
          <Text size="sm" c="red">
            {batch.error}
          </Text>
        )}
      </Stack>
    </Card>
  );
}
