import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it } from 'vitest';

import { LiveUpdatesStatus } from '../LiveUpdatesStatus';

describe('LiveUpdatesStatus', () => {
  it('shows nothing while live updates come in, or are starting', () => {
    renderWithProviders(<LiveUpdatesStatus state="live" />);
    renderWithProviders(<LiveUpdatesStatus state="connecting" />);
    expect(screen.queryByText(/Live updates|Reconnecting/)).not.toBeInTheDocument();
  });

  it('says when they dropped, and when they’re off', () => {
    renderWithProviders(<LiveUpdatesStatus state="reconnecting" />);
    expect(screen.getByText('Reconnecting…')).toBeInTheDocument();
    renderWithProviders(<LiveUpdatesStatus state="off" />);
    expect(screen.getByText('Live updates off')).toBeInTheDocument();
  });
});
