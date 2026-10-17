/**
 * Email (SPEC §8.9): what the event's email is doing now (the queue, and a
 * warning when nothing is sending it), then tabs (`?emailTab`):
 * - Templates: the event's group emails (`?templateId` edits one) and its
 *   automatic emails.
 * - History: every email the event has sent or queued (`?messageId` opens one;
 *   the filters are `?mstatus`, `?mkind`, `?mq`, `?mpage`, and `?mbatch` for
 *   one group email send).
 * - Unsubscribed: the addresses that don't get the event's group email.
 */

import { Stack, Tabs, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { InlineLoading } from 'components/Loading';
import { type EmailHistoryFilters, useEmailQueue } from 'store/email';
import { eventHooks } from 'store/entities';

import { EmailHistory } from './EmailHistory';
import { formatTime } from './emailLabels';
import { EmailTemplates } from './EmailTemplates';
import { EmailUnsubscribes } from './EmailUnsubscribes';
import { QueueStatus } from './QueueStatus';

const FROM = '/admin/organization/$organizationId/event/$eventId';

export function EventAdminEmail() {
  const { organizationId, eventId } = useParams({ from: FROM });
  const search = useSearch({ from: FROM });
  const { emailTab = 'templates', messageId, templateId } = search;
  const navigate = useNavigate();
  const { data: queue } = useEmailQueue(eventId);
  const { data: event } = eventHooks.useById(eventId);

  const helpBase = `/admin/organization/${organizationId}/event/${eventId}/template-help`;

  const setSearch = (patch: Record<string, string | undefined>) =>
    void navigate({
      to: '/admin/organization/$organizationId/event/$eventId/email',
      params: { organizationId, eventId },
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

  return (
    <Stack>
      <Title order={2}>Email</Title>

      {queue && <QueueStatus state={queue} />}

      <Tabs
        value={emailTab}
        onChange={(tab) =>
          setSearch({
            emailTab: tab === 'history' || tab === 'unsubscribed' ? tab : undefined,
          })
        }
      >
        <Tabs.List>
          <Tabs.Tab value="templates">Templates</Tabs.Tab>
          <Tabs.Tab value="history">History</Tabs.Tab>
          <Tabs.Tab value="unsubscribed">Unsubscribed</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="templates" pt="md">
          {event ? (
            <EmailTemplates
              event={event}
              templateId={templateId}
              onEditTemplate={(id) => setSearch({ templateId: id })}
              onSent={(batch) => {
                notifications.show({
                  color: 'green',
                  message: batch.send_at
                    ? `Scheduled for ${formatTime(batch.send_at)}`
                    : `Sending to ${batch.recipient_keys.length} recipients`,
                });
                setSearch({ emailTab: 'history', mbatch: String(batch.id), mpage: undefined });
              }}
              helpBase={helpBase}
            />
          ) : (
            <InlineLoading message="Loading…" />
          )}
        </Tabs.Panel>

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

        <Tabs.Panel value="unsubscribed" pt="md">
          <EmailUnsubscribes eventId={Number(eventId)} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
