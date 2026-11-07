import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { ApiTokenList } from '../ApiTokenList';
import { SAMPLE_TOKENS } from './tokens';

describe('ApiTokenList', () => {
  it('names each token, its prefix, whether it only reads, and where it was made', () => {
    renderWithProviders(<ApiTokenList tokens={SAMPLE_TOKENS} emptyMessage="None" />);
    expect(screen.getByText('Nightly export')).toBeInTheDocument();
    expect(screen.getByText('cmph_Q2xabc12…')).toBeInTheDocument();
    expect(screen.getAllByText('Read-only')).toHaveLength(1);
    expect(screen.getByText(/from the account · expires never · last used/)).toBeInTheDocument();
    expect(screen.getByText(/on the server · expires .* · last used never/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Revoke/ })).not.toBeInTheDocument();
  });

  it('revokes the one chosen', async () => {
    const user = userEvent.setup();
    const onRevoke = vi.fn();
    renderWithProviders(
      <ApiTokenList tokens={SAMPLE_TOKENS} onRevoke={onRevoke} emptyMessage="None" />,
    );
    await user.click(screen.getByRole('button', { name: 'Revoke import (cmph_Zk9pq7Rt)' }));
    expect(onRevoke).toHaveBeenCalledWith(SAMPLE_TOKENS[1]);
  });

  it('says so when there are none', () => {
    renderWithProviders(<ApiTokenList tokens={[]} emptyMessage="No tokens yet." />);
    expect(screen.getByText('No tokens yet.')).toBeInTheDocument();
  });
});
