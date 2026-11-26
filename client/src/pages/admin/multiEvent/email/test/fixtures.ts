import type { ApiOrganizationEmail, ApiOrganizationUnsubscribe } from 'api-types';

export function sampleOrganizationEmail(
  fields: Partial<ApiOrganizationEmail> = {},
): ApiOrganizationEmail {
  return {
    id: 9,
    organization: 1,
    name: 'Come back in 2027',
    subject: '{{ person.name }}, registration is open',
    body: 'Hi {{ person.name }},\n\nYou came {{ person.attended }} times. Come back!',
    from_email: 'camp@example.com',
    reply_to: '',
    account: null,
    filter: { combinator: 'and', rules: [] },
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-02T10:00:00Z',
    version: 1,
    ...fields,
  };
}

export const UNSUBSCRIBED: ApiOrganizationUnsubscribe[] = [
  {
    id: 1,
    organization: 1,
    email: 'pat@example.com',
    source: 'link',
    created_by: null,
    created_by_name: null,
    created_at: '2026-10-20T15:00:00Z',
    version: 1,
  },
  {
    id: 2,
    organization: 1,
    email: 'kim@example.com',
    source: 'admin',
    created_by: 1,
    created_by_name: 'will',
    created_at: '2026-10-18T10:30:00Z',
    version: 1,
  },
];
