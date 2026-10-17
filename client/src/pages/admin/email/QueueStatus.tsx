/**
 * What the event's email is doing now (SPEC §8.9): how much is waiting and when
 * it's next tried, what failed recently, and the two things that hold mail
 * back — no worker running, or the sending account's limit used up.
 */

import { Alert, Group, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconClockPause } from '@tabler/icons-react';
import type { EmailQueueState } from 'api-types';

import { formatTime } from './emailLabels';

/** A pause shorter than this is the per-minute pacing of a normal send, not worth a warning. */
const NOTABLE_PAUSE_MS = 2 * 60 * 1000;

interface QueueStatusProps {
  state: EmailQueueState;
  /** For tests and stories; defaults to the current time. */
  now?: Date;
}

function pauseReason(account: NonNullable<EmailQueueState['account']>) {
  if (account.max_per_day && account.sent_last_day >= account.max_per_day) {
    return `${account.name} has sent its limit of ${account.max_per_day} messages in 24 hours.`;
  }
  if (account.max_per_minute) {
    return `${account.name} sends at most ${account.max_per_minute} messages a minute.`;
  }
  return `${account.name} has reached its sending limit.`;
}

export function QueueStatus({ state, now = new Date() }: QueueStatusProps) {
  const { worker, account } = state;
  const workerDown = worker.required && !worker.alive;
  const pausedUntil = account?.paused_until ? new Date(account.paused_until) : null;
  const notablePause =
    pausedUntil && state.queued > 0 && pausedUntil.getTime() - now.getTime() > NOTABLE_PAUSE_MS;
  const waiting = state.queued + state.sending;

  return (
    <Stack gap="xs">
      {workerDown && (
        <Alert color="red" icon={<IconAlertTriangle size={18} />} title="Email isn't being sent">
          The email worker isn't running
          {worker.last_seen ? ` (last seen ${formatTime(worker.last_seen)})` : ''}. Email is still
          queued and will go out once it runs again.
        </Alert>
      )}
      {notablePause && account && (
        <Alert color="yellow" icon={<IconClockPause size={18} />} title="Sending is paused">
          {pauseReason(account)} The {state.queued} waiting will be sent from{' '}
          {formatTime(account.paused_until)}.
        </Alert>
      )}
      <Group gap="md">
        <Text size="sm" c="dimmed">
          {waiting === 0
            ? 'Nothing waiting to be sent.'
            : `${state.queued} waiting${state.sending ? `, ${state.sending} sending` : ''}` +
              (state.next_attempt_at && state.queued
                ? ` · next try ${formatTime(state.next_attempt_at)}`
                : '')}
        </Text>
        {state.failed_last_day > 0 && (
          <Text size="sm" c="red">
            {state.failed_last_day} failed in the last day
          </Text>
        )}
      </Group>
    </Stack>
  );
}
