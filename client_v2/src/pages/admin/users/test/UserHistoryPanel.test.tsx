import userEvent from '@testing-library/user-event';
import { ENTRIES } from 'components/History/test/entries';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { UserHistoryPanel } from '../UserHistoryPanel';
import { sampleUser } from './userFixtures';

const user = sampleUser({ first_name: 'Reggie', last_name: 'Registrar', username: 'reggie' });

describe('UserHistoryPanel', () => {
  it('names each change in full, without repeating who made it', () => {
    renderWithProviders(
      <UserHistoryPanel
        user={user}
        entries={ENTRIES}
        total={1}
        hasMore={false}
        loadingMore={false}
        onLoadMore={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Changes by Reggie Registrar' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 change$/)).toBeInTheDocument();
    expect(screen.getAllByText(/^Registration #5 \(Lark Camp\): /).length).toBeGreaterThan(0);
    expect(screen.queryByText('Reggie Registrar', { selector: 'p' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show older changes' })).not.toBeInTheDocument();
  });

  it('loads older changes, and closes', async () => {
    const onLoadMore = vi.fn();
    const onClose = vi.fn();
    const clicker = userEvent.setup();
    renderWithProviders(
      <UserHistoryPanel
        user={user}
        entries={ENTRIES}
        total={120}
        hasMore
        loadingMore={false}
        onLoadMore={onLoadMore}
        onClose={onClose}
      />,
    );
    await clicker.click(screen.getByRole('button', { name: 'Show older changes' }));
    expect(onLoadMore).toHaveBeenCalled();
    await clicker.click(screen.getByRole('button', { name: 'Close history' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('says when someone has changed nothing', () => {
    renderWithProviders(
      <UserHistoryPanel
        user={user}
        entries={[]}
        total={0}
        hasMore={false}
        loadingMore={false}
        onLoadMore={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('No changes recorded yet.')).toBeInTheDocument();
  });
});
