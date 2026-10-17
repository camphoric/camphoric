import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it } from 'vitest';

import { QueueStatus } from '../QueueStatus';
import { sampleQueue } from './emailFixtures';

const NOW = new Date('2026-09-01T12:00:00Z');

describe('QueueStatus', () => {
  it('says when nothing is waiting', () => {
    renderWithProviders(<QueueStatus state={sampleQueue()} now={NOW} />);
    expect(screen.getByText('Nothing waiting to be sent.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('warns when no worker is sending email', () => {
    const state = sampleQueue({
      queued: 3,
      worker: { required: true, alive: false, last_seen: null },
    });
    renderWithProviders(<QueueStatus state={state} now={NOW} />);
    expect(screen.getByText("Email isn't being sent")).toBeInTheDocument();
    expect(screen.getByText(/email worker isn't running/)).toBeInTheDocument();
    expect(screen.getByText(/3 waiting/)).toBeInTheDocument();
  });

  it("doesn't warn about a worker in immediate mode", () => {
    const state = sampleQueue({ worker: { required: false, alive: false, last_seen: null } });
    renderWithProviders(<QueueStatus state={state} now={NOW} />);
    expect(screen.queryByText("Email isn't being sent")).not.toBeInTheDocument();
  });

  it('explains a pause for the daily limit', () => {
    const base = sampleQueue();
    const state = sampleQueue({
      queued: 40,
      account: {
        ...base.account!,
        sent_last_day: 500,
        paused_until: '2026-09-01T18:30:00Z',
      },
    });
    renderWithProviders(<QueueStatus state={state} now={NOW} />);
    expect(screen.getByText('Sending is paused')).toBeInTheDocument();
    expect(screen.getByText(/limit of 500 messages in 24 hours/)).toBeInTheDocument();
    expect(screen.getByText(/The 40 waiting will be sent from/)).toBeInTheDocument();
  });

  it("doesn't warn about the per-minute pacing of a normal send", () => {
    const base = sampleQueue();
    const state = sampleQueue({
      queued: 40,
      account: { ...base.account!, sent_last_minute: 20, paused_until: '2026-09-01T12:00:40Z' },
    });
    renderWithProviders(<QueueStatus state={state} now={NOW} />);
    expect(screen.queryByText('Sending is paused')).not.toBeInTheDocument();
  });

  it('counts recent failures', () => {
    renderWithProviders(<QueueStatus state={sampleQueue({ failed_last_day: 2 })} now={NOW} />);
    expect(screen.getByText('2 failed in the last day')).toBeInTheDocument();
  });
});
