/**
 * Ladle stories for the email queue status (SPEC §8.9): quiet, busy, a stopped
 * worker, and an account paused at its daily limit. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';

import { QueueStatus } from '../QueueStatus';
import { sampleQueue } from './emailFixtures';

const NOW = new Date('2026-09-01T12:00:00Z');
const ACCOUNT = sampleQueue().account!;

export const Quiet: Story = () => <QueueStatus state={sampleQueue()} now={NOW} />;

export const Sending: Story = () => (
  <QueueStatus
    state={sampleQueue({ queued: 42, sending: 1, next_attempt_at: '2026-09-01T12:00:05Z' })}
    now={NOW}
  />
);

export const WorkerNotRunning: Story = () => (
  <QueueStatus
    state={sampleQueue({
      queued: 7,
      worker: { required: true, alive: false, last_seen: '2026-09-01T09:14:00Z' },
    })}
    now={NOW}
  />
);

export const PausedAtDailyLimit: Story = () => (
  <QueueStatus
    state={sampleQueue({
      queued: 180,
      failed_last_day: 2,
      account: { ...ACCOUNT, sent_last_day: 500, paused_until: '2026-09-02T08:12:00Z' },
    })}
    now={NOW}
  />
);
