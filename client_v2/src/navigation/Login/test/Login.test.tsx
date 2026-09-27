import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { Login } from '../Login';

const { requestReset } = vi.hoisted(() => ({ requestReset: vi.fn() }));

vi.mock('hooks/auth', () => ({
  useLogin: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useRequestPasswordReset: () => ({
    mutate: requestReset,
    isPending: false,
    isError: false,
    isSuccess: false,
  }),
}));

describe('Login', () => {
  it('switches to asking for a set-password link', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(screen.getByRole('heading', { name: 'Forgot your password?' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Email' }), ' pat@example.com ');
    await user.click(screen.getByRole('button', { name: 'Email me a link' }));
    expect(requestReset).toHaveBeenCalledWith('pat@example.com');
    await user.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(screen.getByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument();
  });
});
