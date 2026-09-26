/**
 * Ladle stories for one email in the history (SPEC §8.9): sent, failed (with
 * Retry), and queued for another try (with Don't send). Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';

import { MessageDetail } from '../MessageDetail';
import { sampleMessage } from './emailFixtures';

const noop = () => {};

export const Sent: Story = () => <MessageDetail message={sampleMessage()} />;

export const Failed: Story = () => (
  <MessageDetail
    message={sampleMessage({
      status: 'failed',
      sent_at: null,
      attempts: 6,
      last_error: 'SMTPRecipientsRefused: pat@example.com: 550 5.1.1 No such user',
    })}
    onRetry={noop}
  />
);

export const Retrying: Story = () => (
  <MessageDetail
    message={sampleMessage({
      status: 'queued',
      sent_at: null,
      attempts: 2,
      next_attempt_at: '2026-09-01T12:35:00Z',
      last_error: 'SMTPResponseException: 421 4.7.0 Try again later',
    })}
    onCancel={noop}
  />
);

export const TextOnly: Story = () => (
  <MessageDetail
    message={sampleMessage({
      kind: 'confirmation_report',
      subject: 'Confirmation email not sent: Camp, registration #12',
      html: '',
      text: 'The confirmation email template has problems:\n- ERROR (template, line 2): ...',
      to: 'registration@camp.org',
      account: null,
      account_name: null,
    })}
  />
);
