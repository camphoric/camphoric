/** How email kinds and statuses read in the admin (SPEC §8.9). */

import type { EmailMessageKind, EmailMessageStatus } from 'api-types';

export const KIND_LABEL: Record<EmailMessageKind, string> = {
  confirmation: 'Confirmation',
  confirmation_report: 'Problem report (confirmation email)',
  page_report: 'Problem report (confirmation page)',
  invitation: 'Invitation',
  bulk: 'Bulk email',
  test: 'Test',
};

export const STATUS_LABEL: Record<EmailMessageStatus, string> = {
  queued: 'Queued',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
  cancelled: 'Not sent',
};

export const STATUS_COLOR: Record<EmailMessageStatus, string> = {
  queued: 'blue',
  sending: 'blue',
  sent: 'green',
  failed: 'red',
  cancelled: 'gray',
};

/** The kind filter's choices; values are `kind__in` lists. */
export const KIND_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All kinds' },
  { value: 'confirmation', label: 'Confirmations' },
  { value: 'invitation', label: 'Invitations' },
  { value: 'bulk', label: 'Bulk email' },
  { value: 'confirmation_report,page_report', label: 'Problem reports' },
  { value: 'test', label: 'Tests' },
];

/** The status filter's choices; values are `status__in` lists. */
export const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'queued,sending', label: 'Waiting' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Not sent' },
];

export function formatTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : '';
}
