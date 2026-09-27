import type { Role } from 'api-types';
import { PermissionsProvider } from 'hooks/permissions';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { EventAdminRegistrations } from '../EventAdminRegistrations';

const search = vi.hoisted(() => ({ current: {} }));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ organizationId: '1', eventId: '7' }),
  useSearch: () => search.current,
  useNavigate: () => vi.fn(),
}));
vi.mock('../RegistrationsList', () => ({ RegistrationsList: () => <div>The list</div> }));
vi.mock('../InvitationsPanel', () => ({ InvitationsPanel: () => <div>Invitations</div> }));
vi.mock('../DeletedPanel', () => ({ DeletedPanel: () => <div>What’s deleted</div> }));

function setup(role: Role, registrationsTab?: string) {
  search.current = { registrationsTab };
  renderWithProviders(
    <PermissionsProvider userRole={role}>
      <EventAdminRegistrations />
    </PermissionsProvider>,
  );
}

describe('EventAdminRegistrations', () => {
  it('has a Deleted tab for Registrars and Admins', () => {
    setup('registrar', 'deleted');
    expect(screen.getByRole('tab', { name: 'Deleted' })).toBeInTheDocument();
    expect(screen.getByText('What’s deleted')).toBeInTheDocument();
  });

  it('hasn’t one for Reporters, even by URL', () => {
    setup('reporter', 'deleted');
    expect(screen.queryByRole('tab', { name: 'Deleted' })).toBeNull();
    expect(screen.queryByText('What’s deleted')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Registrations', selected: true })).toBeInTheDocument();
  });
});
