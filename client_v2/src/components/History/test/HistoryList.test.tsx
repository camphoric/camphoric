import userEvent from '@testing-library/user-event';
import type { ApiHistoryEntry } from 'api-types';
import { renderWithProviders, screen, within } from 'test/utils';
import { describe, expect, it } from 'vitest';

import { VALUE_LIMIT } from '../describe';
import { DIFF_LIMIT, HistoryList } from '../HistoryList';
import { ENTRIES, LOOKUPS, TITLES } from './entries';

/** The cell showing a change, by its whole text ("Berkeley → Oakland"). */
const changeCell = (container: HTMLElement, text: string) =>
  within(container).getByText(
    (_, element) => element?.tagName === 'TD' && element.textContent === text,
  );

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
    expect(changeCell(save, 'Berkeley → Oakland')).toBeInTheDocument();
    expect(changeCell(save, '$825.00 → $850.00')).toBeInTheDocument();
  });

  it('colors the old value red and the new one green', () => {
    renderWithProviders(<HistoryList entries={ENTRIES} options={{ titles: TITLES }} />);
    expect(screen.getByText('Berkeley')).toHaveStyle({ color: 'var(--mantine-color-red-text)' });
    expect(screen.getByText('Oakland')).toHaveStyle({ color: 'var(--mantine-color-green-text)' });
  });

  it('cuts long values short until asked for the rest', async () => {
    const long = 'x'.repeat(VALUE_LIMIT + 50);
    const entry: ApiHistoryEntry = {
      ...ENTRIES[0],
      action: 'update',
      object: { type: 'event', id: 1, label: 'Camp' },
      changes: { name: ['Camp', long] },
    };
    const user = userEvent.setup();
    renderWithProviders(<HistoryList entries={[entry]} />);

    expect(screen.queryByText(long)).not.toBeInTheDocument();
    expect(screen.getByText(`${'x'.repeat(VALUE_LIMIT)}…`)).toBeInTheDocument();
    // The short side of the change is left whole.
    expect(screen.getByText('Camp', { selector: 'span' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show all' }));
    expect(screen.getByText(long)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.queryByText(long)).not.toBeInTheDocument();
  });

  it('leaves short values alone, with nothing to expand', () => {
    renderWithProviders(<HistoryList entries={ENTRIES} options={{ titles: TITLES }} />);
    expect(screen.queryByRole('button', { name: 'Show all' })).not.toBeInTheDocument();
  });

  it('says when nothing has been recorded', () => {
    renderWithProviders(<HistoryList entries={[]} />);
    expect(screen.getByText('No changes recorded yet.')).toBeInTheDocument();
  });

  it('shows a long JSON change as a diff, cut short until asked for the rest', async () => {
    const before = Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [`key${i}`, `value ${i}`]),
    );
    const after = Object.fromEntries(
      Object.entries(before).map(([key, value], i) => [key, i % 3 ? value : `${value}!`]),
    );
    const entry: ApiHistoryEntry = {
      ...ENTRIES[0],
      action: 'update',
      object: { type: 'event', id: 1, label: 'Camp' },
      changes: { registration_schema: [before, after] },
    };
    const user = userEvent.setup();
    const { container } = renderWithProviders(<HistoryList entries={[entry]} />);

    const removed = () => container.querySelectorAll('[data-diff="removed"]');
    expect(removed()[0]).toHaveTextContent('"key0": "value 0",');
    expect(removed()[0]).toHaveStyle({ color: 'var(--mantine-color-red-text)' });
    expect(container.querySelector('[data-diff="added"]')).toHaveTextContent('"key0": "value 0!",');
    const shownBefore = removed().length;

    await user.click(screen.getByRole('button', { name: /^Show all \(\d+ lines\)$/ }));
    expect(removed().length).toBe(10);
    expect(removed().length).toBeGreaterThan(shownBefore);
    expect(shownBefore).toBeLessThanOrEqual(DIFF_LIMIT);
  });
});
