import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UsersOverlay } from '../UsersOverlay';

const { state, close } = vi.hoisted(() => {
  const initial: { overlay?: string; canManageUsers: boolean } = {
    overlay: 'users',
    canManageUsers: true,
  };
  return { state: initial, close: vi.fn() };
});

vi.mock('navigation/overlay', () => ({
  useOverlay: () => ({ overlay: state.overlay, close }),
}));
vi.mock('hooks/permissions', () => ({
  usePermissions: () => ({ canManageUsers: state.canManageUsers }),
}));
vi.mock('../UsersPage', () => ({ UsersPage: () => <p>The users list</p> }));

beforeEach(() => {
  state.overlay = 'users';
  state.canManageUsers = true;
  close.mockClear();
});

describe('UsersOverlay', () => {
  it('shows Users over the page, closed from the upper right', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UsersOverlay />);
    expect(await screen.findByRole('dialog', { name: 'Users' })).toHaveTextContent(
      'The users list',
    );
    await user.click(screen.getByRole('button', { name: 'Close users' }));
    expect(close).toHaveBeenCalled();
  });

  it('leaves Escape to the dialogs opened inside it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UsersOverlay />);
    await screen.findByRole('dialog', { name: 'Users' });
    await user.keyboard('{Escape}');
    expect(close).not.toHaveBeenCalled();
  });

  it('shows nothing unless it’s open, and only to Admins', () => {
    state.overlay = undefined;
    const { unmount } = renderWithProviders(<UsersOverlay />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();

    state.overlay = 'users';
    state.canManageUsers = false;
    renderWithProviders(<UsersOverlay />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
