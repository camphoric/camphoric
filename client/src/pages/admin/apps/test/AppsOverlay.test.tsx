import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppsOverlay } from '../AppsOverlay';

const { state, close } = vi.hoisted(() => {
  const initial: { overlay?: string; canManageApps: boolean } = {
    overlay: 'apps',
    canManageApps: true,
  };
  return { state: initial, close: vi.fn() };
});

vi.mock('navigation/overlay', () => ({
  useOverlay: () => ({ overlay: state.overlay, close }),
}));
vi.mock('hooks/permissions', () => ({
  usePermissions: () => ({ canManageApps: state.canManageApps }),
}));
vi.mock('../AppsPage', () => ({ AppsPage: () => <p>The apps list</p> }));

beforeEach(() => {
  state.overlay = 'apps';
  state.canManageApps = true;
  close.mockClear();
});

describe('AppsOverlay', () => {
  it('shows Apps over the page, closed from the upper right', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppsOverlay />);
    expect(await screen.findByRole('dialog', { name: 'Apps' })).toHaveTextContent('The apps list');
    await user.click(screen.getByRole('button', { name: 'Close apps' }));
    expect(close).toHaveBeenCalled();
  });

  it('shows nothing unless it’s open, and only to Admins', () => {
    state.overlay = 'users';
    const { unmount } = renderWithProviders(<AppsOverlay />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();

    state.overlay = 'apps';
    state.canManageApps = false;
    renderWithProviders(<AppsOverlay />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
