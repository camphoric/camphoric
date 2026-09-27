import { renderWithProviders, screen, within } from 'test/utils';
import { describe, expect, it } from 'vitest';

import { HistoryList } from '../HistoryList';
import { ENTRIES, LOOKUPS, TITLES } from './entries';

describe('HistoryList', () => {
  it('shows who changed what, one save together', () => {
    renderWithProviders(
      <HistoryList entries={ENTRIES} options={{ titles: TITLES, lookups: LOOKUPS }} />,
    );
    expect(screen.getByText('Camper “Sam Alpha”: restored')).toBeInTheDocument();
    expect(screen.getByText('No one signed in')).toBeInTheDocument();

    const save = screen
      .getByText('Main address › City')
      .closest('.mantine-Card-root') as HTMLElement;
    expect(within(save).getByText('Reggie Registrar')).toBeInTheDocument();
    expect(within(save).getByText('Berkeley → Oakland')).toBeInTheDocument();
    expect(within(save).getByText('$825.00 → $850.00')).toBeInTheDocument();
  });

  it('says when nothing has been recorded', () => {
    renderWithProviders(<HistoryList entries={[]} />);
    expect(screen.getByText('No changes recorded yet.')).toBeInTheDocument();
  });
});
