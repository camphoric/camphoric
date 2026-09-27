import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { ApiError } from 'utils/fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChangePasswordForm } from '../ChangePasswordForm';

const { state, mutate } = vi.hoisted(() => ({
  state: { error: null as ApiError | null },
  mutate: vi.fn(),
}));

vi.mock('hooks/auth', () => ({
  useChangePassword: () => ({ mutate, isPending: false, error: state.error }),
}));

beforeEach(() => {
  mutate.mockReset();
  state.error = null;
});

describe('ChangePasswordForm', () => {
  it('sends the current and new passwords', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    renderWithProviders(<ChangePasswordForm onDone={onDone} />);
    await user.type(screen.getByLabelText('Current password'), 'old-one');
    await user.type(screen.getByLabelText('New password'), 'Correct-horse-9');
    await user.type(screen.getByLabelText('New password again'), 'Correct-horse-9');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(mutate).toHaveBeenCalledWith(
      { current_password: 'old-one', new_password: 'Correct-horse-9' },
      { onSuccess: onDone },
    );
  });

  it('shows the server’s objections under their fields', () => {
    state.error = new ApiError(400, 'Bad Request', {
      current_password: ['That isn’t your current password.'],
      new_password: ['This password is too short.'],
    });
    renderWithProviders(<ChangePasswordForm onDone={vi.fn()} />);
    expect(screen.getByText('That isn’t your current password.')).toBeInTheDocument();
    expect(screen.getByText('This password is too short.')).toBeInTheDocument();
  });
});
