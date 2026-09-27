import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { ApiError } from 'utils/fetch';
import { describe, expect, it, vi } from 'vitest';

import { UserForm, type UserFormProps } from '../UserForm';
import { sampleUser } from './userFixtures';

function setup(props: Partial<UserFormProps> = {}) {
  const onSubmit = vi.fn();
  renderWithProviders(<UserForm onSubmit={onSubmit} onCancel={vi.fn()} {...props} />);
  return { user: userEvent.setup(), onSubmit };
}

describe('UserForm', () => {
  it('adds a Reporter by default, emailing them a link', async () => {
    const { user, onSubmit } = setup();
    expect(screen.queryByRole('textbox', { name: 'Django access' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Email them a link/ })).toBeChecked();
    await user.type(screen.getByRole('textbox', { name: /Username/ }), 'lee');
    await user.type(screen.getByRole('textbox', { name: /Email/ }), 'lee@example.com');
    await user.click(screen.getByRole('button', { name: 'Add user' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'lee',
        role: 'reporter',
        django_access: 'regular',
        passwordMode: 'link',
      }),
    );
  });

  it('shows Django access and password choices to a superuser', async () => {
    const { user, onSubmit } = setup({ isSuperuser: true });
    expect(screen.getByRole('textbox', { name: 'Django access' })).toHaveValue('Regular user');
    await user.type(screen.getByRole('textbox', { name: /Username/ }), 'lee');
    await user.type(screen.getByRole('textbox', { name: /Email/ }), 'lee@example.com');
    await user.click(screen.getByRole('radio', { name: 'Set a password now' }));
    const add = screen.getByRole('button', { name: 'Add user' });
    await user.type(screen.getByLabelText('Password'), 'Correct-horse-9');
    await user.type(screen.getByLabelText('Password again'), 'Correct-horse-8');
    expect(screen.getByText('The passwords don’t match.')).toBeInTheDocument();
    expect(add).toBeDisabled();
    await user.clear(screen.getByLabelText('Password again'));
    await user.type(screen.getByLabelText('Password again'), 'Correct-horse-9');
    expect(screen.getByRole('checkbox', { name: /Require a password change/ })).toBeChecked();
    await user.click(add);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordMode: 'password',
        password: 'Correct-horse-9',
        require_change: true,
      }),
    );
  });

  it('won’t let you change your own group, access or active state', () => {
    setup({ user: sampleUser({ role: 'admin' }), isSelf: true, isSuperuser: true });
    expect(screen.getByRole('textbox', { name: 'Camphoric permission group' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Django access' })).toBeDisabled();
    expect(screen.queryByRole('switch', { name: /Active/ })).not.toBeInTheDocument();
  });

  it('keeps a superuser an Admin', () => {
    setup({ user: sampleUser({ role: 'admin', django_access: 'superuser' }), isSuperuser: true });
    const group = screen.getByRole('textbox', { name: 'Camphoric permission group' });
    expect(group).toBeDisabled();
    expect(group).toHaveValue('Admin: everything, including users');
  });

  it('shows the server’s objections under their fields', () => {
    setup({
      error: new ApiError(400, 'Bad Request', {
        email: ['Another user already has this email address.'],
      }),
    });
    expect(screen.getByText('Another user already has this email address.')).toBeInTheDocument();
  });

  it('shows a refusal that isn’t about a field', () => {
    setup({
      user: sampleUser(),
      error: new ApiError(409, 'Conflict', { detail: 'You can’t deactivate your own account.' }),
    });
    expect(screen.getByText('You can’t deactivate your own account.')).toBeInTheDocument();
  });
});
