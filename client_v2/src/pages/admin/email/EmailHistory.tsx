/**
 * The Email section's history (SPEC §8.9; §15 DR-44): every email the event has
 * queued — confirmations, invitations, group email, problem reports and tests
 * — with the queue's state, refreshing every few seconds (faster while mail is
 * waiting), and the group email sends; choosing one shows only its copies. The
 * filters (including the send) and the open message are held by the caller (in
 * the URL, §4).
 */

import { Alert, Anchor, Modal, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ApiEmailMessage, EmailQueueState } from 'api-types';
import { InlineLoading } from 'components/Loading';
import {
  type EmailHistoryFilters,
  pollInterval,
  useCancelEmail,
  useEmailHistory,
  useEmailMessage,
  useRetryEmail,
} from 'store/email';
import { useEmailBatches } from 'store/groupEmail';
import { apiErrorMessage } from 'utils/fetch';

import { EmailBatches } from './EmailBatches';
import { EmailHistoryTable } from './EmailHistoryTable';
import { formatTime } from './emailLabels';
import { MessageDetail } from './MessageDetail';

interface EmailHistoryProps {
  eventId: string;
  queue: EmailQueueState | undefined;
  filters: EmailHistoryFilters;
  onFiltersChange: (filters: EmailHistoryFilters) => void;
  messageId?: number;
  onOpenMessage: (messageId: number | undefined) => void;
}

export function EmailHistory({
  eventId,
  queue,
  filters,
  onFiltersChange,
  messageId,
  onOpenMessage,
}: EmailHistoryProps) {
  const interval = pollInterval(queue);
  const { data: page } = useEmailHistory(eventId, filters, interval);
  const { data: message } = useEmailMessage(messageId, messageId ? interval : false);
  const { data: batches } = useEmailBatches(eventId);
  const batchId = filters.batch ? Number(filters.batch) : undefined;
  const batch = batches?.find((b) => b.id === batchId);
  const showBatch = (id: number | undefined) =>
    onFiltersChange({ ...filters, batch: id ? String(id) : undefined, page: 1 });
  const retry = useRetryEmail();
  const cancel = useCancelEmail();

  const act = (mutation: typeof retry, done: string) => (target: ApiEmailMessage) =>
    mutation.mutate(target.id, {
      onSuccess: () => notifications.show({ color: 'green', message: done }),
      onError: (error) => notifications.show({ color: 'red', message: apiErrorMessage(error) }),
    });

  return (
    <Stack>
      <EmailBatches batches={batches ?? []} selectedId={batchId} onSelect={showBatch} />
      {batchId !== undefined && (
        <Alert variant="light" p="xs">
          Showing only the emails of{' '}
          {batch ? `“${batch.name}”, sent ${formatTime(batch.created_at)}` : 'one send'}.{' '}
          <Anchor component="button" type="button" size="sm" onClick={() => showBatch(undefined)}>
            Show all emails
          </Anchor>
        </Alert>
      )}
      <EmailHistoryTable
        page={page}
        filters={filters}
        onFiltersChange={onFiltersChange}
        onOpen={(m) => onOpenMessage(m.id)}
        selectedId={messageId}
      />
      <Modal
        opened={messageId !== undefined}
        onClose={() => onOpenMessage(undefined)}
        title="Email"
        size="xl"
      >
        {message ? (
          <MessageDetail
            message={message}
            onRetry={() => act(retry, 'Queued to send again')(message)}
            onCancel={() => act(cancel, 'It won’t be sent')(message)}
            busy={retry.isPending || cancel.isPending}
          />
        ) : (
          <InlineLoading message="Loading email…" />
        )}
      </Modal>
    </Stack>
  );
}
