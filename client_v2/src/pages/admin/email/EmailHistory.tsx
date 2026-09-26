/**
 * The Email section's history (SPEC §8.9; §15 DR-43): every email the event has
 * queued — confirmations, invitations, bulk email, problem reports and tests —
 * with the queue's state, refreshing every few seconds (faster while mail is
 * waiting). The filters and the open message are held by the caller (in the
 * URL, §4).
 */

import { Modal } from '@mantine/core';
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

import { EmailHistoryTable } from './EmailHistoryTable';
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
  const retry = useRetryEmail();
  const cancel = useCancelEmail();

  const act = (mutation: typeof retry, done: string) => (target: ApiEmailMessage) =>
    mutation.mutate(target.id, {
      onSuccess: () => notifications.show({ color: 'green', message: done }),
      onError: (error) => notifications.show({ color: 'red', message: error.message }),
    });

  return (
    <>
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
    </>
  );
}
