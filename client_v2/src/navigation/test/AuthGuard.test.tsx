import { anonymousUser, type ApiUser } from 'api-types';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../AuthGuard';

const { current } = vi.hoisted(() => ({ current: { user: undefined as ApiUser | undefined } }));

vi.mock('hooks/auth', () => ({
  useCurrentUser: () => ({ data: current.user, isLoading: false }),
  isAuthenticated: (user?: ApiUser) => !!user && user.username !== '',
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('hooks/useSessionMonitor', () => ({ useSessionMonitor: () => undefined }));
vi.mock('navigation/Login', () => ({ Login: () => <p>Sign in</p> }));

const user = (fields: Partial<ApiUser>): ApiUser => ({
  ...anonymousUser,
  id: 3,
  username: 'pat',
  is_active: true,
  ...fields,
});

function renderGuard(signedIn: ApiUser | undefined) {
  current.user = signedIn;
  renderWithProviders(
    <AuthGuard>
      <p>The admin</p>
    </AuthGuard>,
  );
}

describe('AuthGuard', () => {
  it('asks a signed-out visitor to sign in', () => {
    renderGuard(anonymousUser);
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('tells someone without a permission group they have no access', () => {
    renderGuard(user({ role: null }));
    expect(screen.getByRole('heading', { name: 'No access yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByText('The admin')).not.toBeInTheDocument();
  });

  it('lets anyone with a group in', () => {
    renderGuard(user({ role: 'reporter' }));
    expect(screen.getByText('The admin')).toBeInTheDocument();
  });
});
