import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { SetPasswordForm } from '../SetPasswordForm';

describe('SetPasswordForm', () => {
  it('needs the password twice, the same', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(<SetPasswordForm username="pat" onSubmit={onSubmit} />);
    expect(screen.getByText('pat')).toBeInTheDocument();
    const set = screen.getByRole('button', { name: 'Set password' });
    await user.type(screen.getByLabelText('New password'), 'Correct-horse-9');
    await user.type(screen.getByLabelText('New password again'), 'Correct-horse');
    expect(screen.getByText('The passwords don’t match.')).toBeInTheDocument();
    expect(set).toBeDisabled();
    await user.type(screen.getByLabelText('New password again'), '-9');
    await user.click(set);
    expect(onSubmit).toHaveBeenCalledWith('Correct-horse-9');
  });

  it('shows the server’s objection', () => {
    renderWithProviders(
      <SetPasswordForm username="pat" onSubmit={vi.fn()} error="This password is too common." />,
    );
    expect(screen.getByText('This password is too common.')).toBeInTheDocument();
  });
});
