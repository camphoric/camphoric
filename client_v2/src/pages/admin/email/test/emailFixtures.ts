/** Sample email outbox data for the Email section's tests and stories. */

import type {
  ApiEmailBatch,
  ApiEmailMessage,
  ApiEmailTemplate,
  AudienceResolution,
  EmailQueueState,
} from 'api-types';

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

export function sampleTemplate(fields: Partial<ApiEmailTemplate> = {}): ApiEmailTemplate {
  return {
    id: 5,
    event: 7,
    purpose: 'group',
    name: 'Balance reminder',
    subject: 'Your balance for {{ event.name }}',
    body: 'Hi {{ recipient.name }}, you owe {{ registration.balance | money }}.',
    from_email: '',
    reply_to: '',
    account: null,
    recipient_source: 'registrations',
    filter: { combinator: 'and', rules: [{ field: 'registration.balance', op: 'gt', value: 0 }] },
    filter_expression: '',
    address_expression: '',
    name_expression: '',
    recipient_list: '',
    include_incomplete: false,
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-02T12:00:00Z',
    ...fields,
  };
}

export function sampleAudience(fields: Partial<AudienceResolution> = {}): AudienceResolution {
  return {
    recipients: [
      {
        key: 'camper:3',
        email: 'lee@example.com',
        name: 'Lee Park',
        label: 'Lee Park (camper #3)',
        registration: 2,
        camper: 3,
        already_sent: false,
      },
      {
        key: 'camper:4',
        email: 'sam@example.com',
        name: 'Sam Park',
        label: 'Sam Park (camper #4)',
        registration: 2,
        camper: 4,
        already_sent: true,
      },
    ],
    skipped: [
      {
        label: 'Kit Doe (camper #9)',
        reason: 'no_address',
        detail: '',
        email: '',
        registration: 5,
        camper: 9,
      },
    ],
    diagnostics: [],
    ...fields,
  };
}

export function sampleBatch(fields: Partial<ApiEmailBatch> = {}): ApiEmailBatch {
  return {
    id: 31,
    event: 7,
    template: 5,
    name: 'Balance reminder',
    subject: 'Your balance for {{ event.name }}',
    body: 'Hi {{ recipient.name }}',
    recipient_source: 'campers',
    recipient_keys: ['camper:3', 'camper:4', 'camper:5', 'camper:6'],
    account: null,
    from_email: '',
    reply_to: '',
    skip_already_sent: true,
    send_at: null,
    status: 'sending',
    skipped: [],
    error: '',
    created_by: 1,
    created_by_name: 'will',
    total: 4,
    sent: 2,
    failed: 1,
    cancelled: 0,
    waiting: 1,
    state: 'sending',
    created_at: '2026-09-20T15:00:00Z',
    updated_at: '2026-09-20T15:01:00Z',
    ...fields,
  };
}
