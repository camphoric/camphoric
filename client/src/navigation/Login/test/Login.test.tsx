import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { ApiError } from 'utils/fetch';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Login } from '../Login';

const { requestReset, loginFailure } = vi.hoisted(() => {
  // The error useLogin reports; null while sign-in hasn't failed
  const loginFailure: { error: unknown } = { error: null };
  return { requestReset: vi.fn(), loginFailure };
});

vi.mock('hooks/auth', () => ({
  useLogin: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: loginFailure.error !== null,
    error: loginFailure.error,
  }),
  useRequestPasswordReset: () => ({
    mutate: requestReset,
    isPending: false,
    isError: false,
    isSuccess: false,
  }),
}));

describe('Login', () => {
  afterEach(() => {
    loginFailure.error = null;
  });

  it('says when the password is wrong', () => {
    loginFailure.error = new ApiError(400, 'Bad Request', { detail: 'Login failed' });
    renderWithProviders(<Login />);
    expect(screen.getByText('Invalid username or password.')).toBeInTheDocument();
  });

  it.each([
    [42, 'Too many sign-in attempts. Try again in 42 seconds.'],
    [1500, 'Too many sign-in attempts. Try again in 25 minutes.'],
    [null, 'Too many sign-in attempts. Try again later.'],
  ])('says how long to wait after too many attempts (Retry-After %s)', (retryAfter, message) => {
    const body = { detail: 'Request was throttled.' };
    loginFailure.error = new ApiError(429, 'Too Many Requests', body, retryAfter);
    renderWithProviders(<Login />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });

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
