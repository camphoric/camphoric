import type { ApiPromoCode, ApiRegistrationType } from 'api-types';

export function samplePromoCode(overrides: Partial<ApiPromoCode> = {}): ApiPromoCode {
  return {
    id: 3,
    event: 7,
    label: 'Early bird',
    code: 'EARLY',
    pricing_logic: { '*': [{ var: 'total' }, 0.1] },
    scope: 'registration',
    enabled: true,
    expiration_date: null,
    excluded_registration_types: [],
    excludes_uninvited: false,
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-01T12:00:00Z',
    ...overrides,
  };
}

export function sampleRegistrationType(id: number, label: string): ApiRegistrationType {
  return {
    id,
    event: 7,
    name: label.toLowerCase(),
    label,
    invitation_template: null,
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-01T12:00:00Z',
  };
}
