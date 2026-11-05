import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { ConnectedAppsList } from '../ConnectedAppsList';
import { SAMPLE_CONNECTIONS } from './connections';

describe('ConnectedAppsList', () => {
  it('names each app, what it may do, and when it was last used', () => {
    renderWithProviders(
      <ConnectedAppsList connections={SAMPLE_CONNECTIONS} show="application" emptyMessage="None" />,
    );
    expect(screen.getByText('Lark admin tool')).toBeInTheDocument();
    expect(screen.getByText('Roster sync')).toBeInTheDocument();
    expect(screen.getAllByText('Read')).toHaveLength(2);
    expect(screen.getAllByText('Change')).toHaveLength(1);
    expect(screen.getByText(/last used never/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Disconnect/ })).not.toBeInTheDocument();
  });

  it('names the person in an app’s list, and disconnects the one chosen', async () => {
    const user = userEvent.setup();
    const onDisconnect = vi.fn();
    renderWithProviders(
      <ConnectedAppsList
        connections={SAMPLE_CONNECTIONS}
        show="user"
        onDisconnect={onDisconnect}
        emptyMessage="None"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Disconnect Sam Beta (sam)' }));
    expect(onDisconnect).toHaveBeenCalledWith(SAMPLE_CONNECTIONS[1]);
  });

  it('says so when there are none', () => {
    renderWithProviders(
      <ConnectedAppsList connections={[]} show="application" emptyMessage="No apps yet." />,
    );
    expect(screen.getByText('No apps yet.')).toBeInTheDocument();
  });
});
