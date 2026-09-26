import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { EmailAccountForm } from '../EmailAccountForm';
import { sampleAccount } from './emailAccountFixtures';

function renderForm(props: Partial<Parameters<typeof EmailAccountForm>[0]> = {}) {
  const onSubmit = vi.fn();
  renderWithProviders(
    <EmailAccountForm organizationId={1} onSubmit={onSubmit} onCancel={vi.fn()} {...props} />,
  );
  return onSubmit;
}

describe('EmailAccountForm', () => {
  it('adds an account, with its password and limits', async () => {
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText(/^Name/), 'Camp Gmail');
    await userEvent.type(screen.getByLabelText(/^Mail server/), 'smtp.gmail.com');
    await userEvent.type(screen.getByLabelText('Username'), 'reg@camp.org');
    await userEvent.type(screen.getByLabelText('Password'), 'app-password');
    await userEvent.type(screen.getByLabelText('Most messages a day'), '500');
    await userEvent.click(screen.getByRole('button', { name: 'Add account' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        organization: 1,
        name: 'Camp Gmail',
        host: 'smtp.gmail.com',
        port: 587,
        security: 'starttls',
        username: 'reg@camp.org',
        password: 'app-password',
        max_per_minute: null,
        max_per_day: 500,
      }),
    );
  });

  it('needs a name and a server', async () => {
    const onSubmit = renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Add account' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Give the account a name')).toBeInTheDocument();
    expect(screen.getByText('Enter the mail server')).toBeInTheDocument();
  });

  it('moves the port with the security', async () => {
    renderForm();
    await userEvent.click(screen.getByText('SSL/TLS'));
    expect(screen.getByLabelText('Port')).toHaveValue('465');
  });

  it('keeps the stored password when it is left blank', async () => {
    const onSubmit = renderForm({ account: sampleAccount() });
    expect(screen.getByText('Leave blank to keep the stored password.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.not.objectContaining({ password: '' }));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('password');
  });

  it('asks for a password it can no longer read', async () => {
    const onSubmit = renderForm({ account: sampleAccount({ password_status: 'unreadable' }) });
    expect(screen.getByText('The stored password can’t be read')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter the password again')).toBeInTheDocument();
  });

  it('has no server settings for a log-only account', () => {
    renderForm({
      account: sampleAccount({ backend: 'django.core.mail.backends.console.EmailBackend' }),
    });
    expect(screen.queryByLabelText(/^Mail server/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });
});
