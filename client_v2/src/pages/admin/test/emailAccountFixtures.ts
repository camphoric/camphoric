/** Sample email accounts for the email settings' tests and stories. */

import type { ApiEmailAccount } from 'api-types';

export function sampleAccount(fields: Partial<ApiEmailAccount> = {}): ApiEmailAccount {
  return {
    id: 3,
    organization: 1,
    name: 'Camp Gmail',
    backend: 'django.core.mail.backends.smtp.EmailBackend',
    host: 'smtp.gmail.com',
    port: 587,
    security: 'starttls',
    timeout: 30,
    username: 'registration@camp.org',
    password_status: 'set',
    max_per_minute: 20,
    max_per_day: 500,
    default_reply_to: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...fields,
  };
}
