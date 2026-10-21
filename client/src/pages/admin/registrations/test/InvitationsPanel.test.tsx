import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiInvitation } from 'api-types';
import type { ReactNode } from 'react';
import { renderWithProviders, screen, within } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { InvitationsPanel } from '../InvitationsPanel';

const { invitations } = vi.hoisted(() => ({ invitations: { current: [] as ApiInvitation[] } }));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ organizationId: '1', eventId: '7' }),
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
}));
vi.mock('hooks/permissions', () => ({
  CanEdit: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('hooks/useAdminData', () => ({
  useRegistrationTypeLookup: () => ({ '3': { id: 3, label: 'Staff' } }),
}));
vi.mock('store/entities', () => ({
  registrationTypeHooks: { useList: () => ({ data: [{ id: 3, label: 'Staff' }] }) },
  invitationHooks: {
    useList: () => ({ data: invitations.current }),
    useDelete: () => ({ mutate: vi.fn() }),
  },
}));
vi.mock('store/invitations', () => ({
  useSendInvitation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('../InviteForm', () => ({ InviteForm: () => null }));

function invitation(fields: Partial<ApiInvitation>): ApiInvitation {
  return {
    id: 1,
    registration_type: 3,
    invitation_code: 'abcd2345',
    recipient_name: '',
    recipient_email: 'lee@example.com',
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-01T12:00:00Z',
    version: 1,
    register_link: 'https://reg.example.org/events/7/register?code=abcd2345',
    ...fields,
  };
}

function row(email: string) {
  return within(screen.getByText(email).closest('tr') as HTMLElement);
}

describe('InvitationsPanel', () => {
  it('treats one only started with as still usable (#803)', () => {
    invitations.current = [
      invitation({ id: 1, recipient_email: 'started@example.com', registration: 5 }),
      invitation({
        id: 2,
        recipient_email: 'redeemed@example.com',
        registration: 6,
        redeemed: true,
      }),
    ];
    renderWithProviders(
      <QueryClientProvider client={new QueryClient()}>
        <InvitationsPanel />
      </QueryClientProvider>,
    );

    const started = row('started@example.com');
    expect(started.queryByText('Redeemed')).not.toBeInTheDocument();
    expect(started.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
    expect(
      started.getByRole('button', { name: 'Copy the registration link for started@example.com' }),
    ).toBeInTheDocument();

    const redeemed = row('redeemed@example.com');
    expect(redeemed.getByText('Redeemed')).toBeInTheDocument();
    expect(redeemed.getByRole('button', { name: 'View' })).toBeInTheDocument();
    expect(redeemed.queryByRole('button', { name: /Copy the registration link/ })).toBeNull();
  });
});
