import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, within } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { UsersTable } from '../UsersTable';
import { SAMPLE_USERS } from './userFixtures';

function setup(withSetPassword: boolean) {
  const actions = {
    onEdit: vi.fn(),
    onSendLink: vi.fn(),
    onCopyLink: vi.fn(),
    onSetPassword: withSetPassword ? vi.fn() : undefined,
    onToggleActive: vi.fn(),
    onDelete: vi.fn(),
  };
  renderWithProviders(<UsersTable users={SAMPLE_USERS} currentUserId={1} {...actions} />);
  return { user: userEvent.setup(), actions };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>, username: string) {
  await user.click(screen.getByRole('button', { name: `Actions for ${username}` }));
  return screen.findByRole('menu', { hidden: true });
}

describe('UsersTable', () => {
  it('shows groups, Django access and account state', () => {
    setup(true);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('root (you)')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Superuser (for developers)')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Reporter')).toBeInTheDocument();
    expect(within(rows[2]).getByText('No password yet')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Never')).toBeInTheDocument();
    expect(within(rows[3]).getByText('No access')).toBeInTheDocument();
    expect(within(rows[3]).getByText('Deactivated')).toBeInTheDocument();
  });

  it('can’t deactivate, delete or set the password of your own account', async () => {
    const { user } = setup(true);
    const menu = await openMenu(user, 'root');
    expect(within(menu).getByRole('menuitem', { name: 'Edit', hidden: true })).toBeInTheDocument();
    for (const name of ['Deactivate', 'Delete', 'Set password']) {
      expect(within(menu).queryByRole('menuitem', { name, hidden: true })).not.toBeInTheDocument();
    }
  });

  it('offers a superuser Set password for others', async () => {
    const { user, actions } = setup(true);
    const menu = await openMenu(user, 'pat');
    await user.click(within(menu).getByRole('menuitem', { name: 'Set password', hidden: true }));
    expect(actions.onSetPassword).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  });

  it('hides Set password from other Admins, and links from deactivated users', async () => {
    const { user, actions } = setup(false);
    const menu = await openMenu(user, 'pat');
    expect(
      within(menu).queryByRole('menuitem', { name: 'Set password', hidden: true }),
    ).not.toBeInTheDocument();
    await user.click(within(menu).getByRole('menuitem', { name: 'Deactivate', hidden: true }));
    expect(actions.onToggleActive).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
    await user.click(screen.getByRole('button', { name: 'Actions for kim' }));
    const reactivate = await screen.findByRole('menuitem', { name: 'Reactivate', hidden: true });
    const kimMenu = reactivate.closest('[role="menu"]') as HTMLElement;
    expect(
      within(kimMenu).queryByRole('menuitem', { name: /set-password link/, hidden: true }),
    ).not.toBeInTheDocument();
  });
});
