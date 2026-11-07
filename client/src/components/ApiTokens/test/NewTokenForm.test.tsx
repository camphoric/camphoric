import userEvent from '@testing-library/user-event';
import type { NewTokenRequest } from 'api-types';
import { renderWithProviders, screen } from 'test/utils';
import { ApiError } from 'utils/fetch';
import { describe, expect, it, vi } from 'vitest';

import { NewTokenForm } from '../NewTokenForm';

const DAY_MS = 24 * 60 * 60 * 1000;

function form(maxDays: number | null, error?: unknown) {
  const onSubmit = vi.fn<(values: NewTokenRequest) => void>();
  renderWithProviders(
    <NewTokenForm maxDays={maxDays} error={error} onSubmit={onSubmit} onCancel={vi.fn()} />,
  );
  return { onSubmit, user: userEvent.setup() };
}

async function chooseExpiry(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('combobox', { name: /Expires/ }));
  await user.click(await screen.findByRole('option', { name: label }));
}

describe('NewTokenForm', () => {
  it('waits for a name and an expiry: none is chosen for you', async () => {
    const { user } = form(null);
    const create = screen.getByRole('button', { name: 'Create token' });
    expect(screen.getByRole('combobox', { name: /Expires/ })).toHaveValue('');
    expect(create).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'Export');
    expect(create).toBeDisabled();
    await chooseExpiry(user, 'Never');
    expect(create).toBeEnabled();
  });

  it('sends a token that never expires as null, read-only when ticked', async () => {
    const { onSubmit, user } = form(null);
    await user.type(screen.getByRole('textbox', { name: /Name/ }), ' Nightly export ');
    await chooseExpiry(user, 'Never');
    await user.click(screen.getByRole('checkbox', { name: /Read-only/ }));
    await user.click(screen.getByRole('button', { name: 'Create token' }));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Nightly export',
      expires_at: null,
      read_only: true,
    });
  });

  it('counts a number of days from now', async () => {
    const { onSubmit, user } = form(null);
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'import');
    await chooseExpiry(user, 'In 7 days');
    await user.click(screen.getByRole('button', { name: 'Create token' }));
    const sent = onSubmit.mock.calls[0][0];
    expect(sent.read_only).toBe(false);
    const days = (new Date(sent.expires_at ?? '').getTime() - Date.now()) / DAY_MS;
    expect(days).toBeCloseTo(7, 2);
  });

  it('doesn’t offer never when the server caps how long a token lasts', async () => {
    const { user } = form(30);
    expect(screen.getByText('A token may last at most 30 days here.')).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: /Expires/ }));
    expect(await screen.findByRole('option', { name: 'In 30 days' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Never' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'In 90 days' })).not.toBeInTheDocument();
  });

  it('asks for a date and time when you’d rather choose one', async () => {
    const { user } = form(null);
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'import');
    await chooseExpiry(user, 'On a date and time you choose');
    expect(screen.getByText('Expires at')).toBeInTheDocument();
    // Not yet chosen.
    expect(screen.getByRole('button', { name: 'Create token' })).toBeDisabled();
  });

  it('shows the server’s refusal under its field', () => {
    form(null, new ApiError(400, 'Bad Request', { name: ['This field may not be blank.'] }));
    expect(screen.getByText('This field may not be blank.')).toBeInTheDocument();
  });

  it('shows any other refusal under the form', () => {
    form(null, new ApiError(403, 'Forbidden', { detail: 'Tokens can’t make tokens.' }));
    expect(screen.getByText('Tokens can’t make tokens.')).toBeInTheDocument();
  });
});
