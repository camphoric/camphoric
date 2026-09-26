import type { ApiInvitation } from 'api-types';
import { describe, expect, it } from 'vitest';

import { invitationStatus } from '../InvitationsPanel';

function invitation(fields: Partial<ApiInvitation> = {}): ApiInvitation {
  return {
    id: 1,
    invitation_code: 'abcd2345',
    recipient_name: 'Lee',
    recipient_email: 'lee@example.com',
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-01T12:00:00Z',
    ...fields,
  };
}

function email(status: NonNullable<ApiInvitation['email']>['status']) {
  return { id: 9, status, error: '', queued_at: '2026-09-01T12:00:00Z', sent_at: null };
}

describe('invitationStatus', () => {
  it('follows the latest email', () => {
    expect(invitationStatus(invitation())).toBe('Unsent');
    expect(invitationStatus(invitation({ email: email('queued') }))).toBe('Sending');
    expect(invitationStatus(invitation({ email: email('sending') }))).toBe('Sending');
    expect(invitationStatus(invitation({ email: email('sent') }))).toBe('Sent');
    expect(invitationStatus(invitation({ email: email('failed') }))).toBe('Failed');
    expect(invitationStatus(invitation({ email: email('cancelled') }))).toBe('Not sent');
  });

  it('counts an invitation sent before email was queued', () => {
    expect(invitationStatus(invitation({ sent_time: '2026-01-01T00:00:00Z' }))).toBe('Sent');
  });

  it('is redeemed once it has a registration, whatever its email did', () => {
    expect(invitationStatus(invitation({ registration: 5, email: email('failed') }))).toBe(
      'Redeemed',
    );
  });
});
