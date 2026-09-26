/** Sample email outbox data for the Email section's tests and stories. */

import type { ApiEmailMessage, EmailQueueState } from 'api-types';

export function sampleMessage(fields: Partial<ApiEmailMessage> = {}): ApiEmailMessage {
  return {
    id: 1,
    event: 7,
    kind: 'confirmation',
    registration: 12,
    invitation: null,
    account: 3,
    account_name: 'Camp Gmail',
    from_email: 'registration@camp.org',
    to: 'pat@example.com',
    reply_to: '',
    subject: 'Welcome to camp, Pat!',
    text: 'Thanks for registering, Pat.\n\nSee you in July.',
    html: '<p>Thanks for registering, <strong>Pat</strong>.</p><p>See you in July.</p>',
    status: 'sent',
    attempts: 1,
    next_attempt_at: '2026-09-01T12:00:00Z',
    last_error: '',
    sent_at: '2026-09-01T12:00:02Z',
    smtp_message_id: '<abc@camp.org>',
    created_by: null,
    created_by_name: null,
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-01T12:00:02Z',
    ...fields,
  };
}

export function sampleQueue(fields: Partial<EmailQueueState> = {}): EmailQueueState {
  return {
    queued: 0,
    sending: 0,
    failed_last_day: 0,
    next_attempt_at: null,
    worker: { required: true, alive: true, last_seen: '2026-09-01T12:00:00Z' },
    account: {
      id: 3,
      name: 'Camp Gmail',
      max_per_minute: 20,
      max_per_day: 500,
      sent_last_minute: 0,
      sent_last_day: 12,
      paused_until: null,
    },
    ...fields,
  };
}
