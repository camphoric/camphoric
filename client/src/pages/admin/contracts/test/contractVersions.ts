import type { ApiContract, ApiContractAgreement } from 'api-types';

export const DRAFT_BODY =
  '## Privacy Policy\n\nWe keep your data safe.\n\n## Liability Waiver\n\nUse at your own risk.';

export const PUBLISHED_VERSION: ApiContract = {
  id: 7,
  organization: 3,
  number: 1,
  content_sha256: 'a'.repeat(64),
  published_at: '2026-11-01T17:00:00Z',
  published_by: 1,
  published_by_name: 'Ada Admin',
  agreement_count: 2,
  body: DRAFT_BODY,
  created_at: '2026-10-30T17:00:00Z',
  updated_at: '2026-11-01T17:00:00Z',
  version: 3,
};

export const AGREEMENTS: ApiContractAgreement[] = [
  {
    id: 1,
    organization: 3,
    contract: 7,
    contract_number: 1,
    user: 1,
    agreed_at: '2026-11-01T17:05:00Z',
    username: 'ada',
    email: 'ada@example.com',
    full_name: 'Ada Admin',
    ip_address: '203.0.113.5',
    user_agent: 'Mozilla/5.0 (Macintosh) Firefox/200.0',
    content_sha256: 'a'.repeat(64),
    assent_text: 'I agree',
    app_version: '1.40.0',
  },
  {
    id: 2,
    organization: 3,
    contract: 7,
    contract_number: 1,
    user: null,
    agreed_at: '2026-11-02T09:12:00Z',
    username: 'rita',
    email: '',
    full_name: '',
    ip_address: null,
    user_agent: '',
    content_sha256: 'a'.repeat(64),
    assent_text: 'I agree',
    app_version: '1.40.0',
  },
];
