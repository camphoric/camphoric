import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { NewTokenSecret } from '../NewTokenSecret';
import { SAMPLE_NEW_TOKEN } from './tokens';

describe('NewTokenSecret', () => {
  it('shows the whole token once, says it won’t be shown again, and copies it', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    renderWithProviders(<NewTokenSecret token={SAMPLE_NEW_TOKEN} onDone={onDone} />);
    expect(screen.getByRole('textbox', { name: 'Roster script' })).toHaveValue(
      SAMPLE_NEW_TOKEN.token,
    );
    expect(screen.getByText(/only time you’ll see this token/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy the token' }));
    expect(await navigator.clipboard.readText()).toBe(SAMPLE_NEW_TOKEN.token);
    expect(screen.getByRole('button', { name: 'Copy the token' })).toHaveTextContent('Copied');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalled();
  });
});
