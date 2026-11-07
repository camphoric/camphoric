import userEvent from '@testing-library/user-event';
import type { ApiNewToken, ApiToken, NewTokenRequest } from 'api-types';
import { SAMPLE_NEW_TOKEN, SAMPLE_TOKENS } from 'components/ApiTokens/test/tokens';
import { renderWithProviders, screen, within } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiTokensModal } from '../ApiTokensModal';

const { state, create, revoke } = vi.hoisted(() => ({
  state: { tokens: [] as ApiToken[], maxDays: null as number | null },
  create: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock('hooks/auth', () => ({
  useCurrentUser: () => ({ data: { api_token_max_days: state.maxDays } }),
}));
vi.mock('store/tokens', () => ({
  useMyTokens: () => ({ isPending: false, isError: false, data: state.tokens }),
  useCreateToken: () => ({ mutate: create, isPending: false, error: null, reset: vi.fn() }),
  useRevokeToken: () => ({ mutate: revoke, isPending: false }),
}));

beforeEach(() => {
  state.tokens = SAMPLE_TOKENS;
  state.maxDays = null;
  create.mockReset();
  revoke.mockReset();
});

describe('ApiTokensModal', () => {
  it('lists your tokens and says a password change revokes them', () => {
    renderWithProviders(<ApiTokensModal opened onClose={vi.fn()} />);
    expect(screen.getByText('Nightly export')).toBeInTheDocument();
    expect(screen.getByText(/Changing your password revokes them all/)).toBeInTheDocument();
  });

  it('makes a token, then shows it once', async () => {
    const user = userEvent.setup();
    create.mockImplementation(
      (_body: NewTokenRequest, { onSuccess }: { onSuccess: (token: ApiNewToken) => void }) =>
        onSuccess(SAMPLE_NEW_TOKEN),
    );
    const onClose = vi.fn();
    renderWithProviders(<ApiTokensModal opened onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'New token' }));
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'Roster script');
    await user.click(screen.getByRole('combobox', { name: /Expires/ }));
    await user.click(await screen.findByRole('option', { name: 'Never' }));
    await user.click(screen.getByRole('button', { name: 'Create token' }));
    expect(create).toHaveBeenCalledWith(
      { name: 'Roster script', expires_at: null, read_only: false },
      expect.anything(),
    );
    expect(screen.getByRole('textbox', { name: 'Roster script' })).toHaveValue(
      SAMPLE_NEW_TOKEN.token,
    );

    // Done goes back to the list, and the token isn't shown there.
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByDisplayValue(SAMPLE_NEW_TOKEN.token)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New token' })).toBeInTheDocument();
  });

  it('asks before revoking a token', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ApiTokensModal opened onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Revoke import (cmph_Zk9pq7Rt)' }));
    const confirm = await screen.findByRole('dialog', { name: 'Revoke import?' });
    expect(revoke).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Revoke' }));
    expect(revoke).toHaveBeenCalledWith({ tokenId: 2 }, expect.anything());
  });
});
