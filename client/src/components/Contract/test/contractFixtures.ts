import type { ApiPublishedContract } from 'api-types';

/** A published version: a privacy policy and a liability waiver. */
export const PUBLISHED_CONTRACT: ApiPublishedContract = {
  id: 7,
  organization: 3,
  organization_name: 'Lark Camp',
  number: 2,
  content_sha256: 'a'.repeat(64),
  published_at: '2026-11-01T17:00:00Z',
  sections: [
    {
      kind: 'privacy_policy',
      title: 'Privacy Policy',
      body: [
        'We collect what you enter when you register: names, contact details and',
        'emergency contacts.',
        '',
        '- We share payments with **PayPal**.',
        '- We keep incomplete registrations for 30 days.',
      ].join('\n'),
    },
    {
      kind: 'custom',
      title: 'Liability Waiver',
      body: 'Camphoric is provided “as is”. <script>alert(1)</script>Use it at your own risk.',
    },
  ],
};
