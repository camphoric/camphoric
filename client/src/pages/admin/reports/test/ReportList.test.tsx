import userEvent from '@testing-library/user-event';
import type { ApiReport } from 'api-types';
import { renderWithProviders, screen, within } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { groupReports } from '../reportGroups';
import { ReportList } from '../ReportList';

const report = (id: number, title: string, category = ''): ApiReport =>
  ({ id, event: 7, title, category, description: '', version: 1 }) as ApiReport;

const REPORTS = [
  report(1, 'Payments', 'Finance'),
  report(2, 'Balances', 'Finance'),
  report(3, 'Rooms', 'Rooming'),
  report(4, 'Summary'),
];

function setup(reports: ApiReport[] = REPORTS, selectedId?: number) {
  const onSelect = vi.fn();
  const view = renderWithProviders(
    <ReportList groups={groupReports(reports)} selectedId={selectedId} onSelect={onSelect} />,
  );
  const rerender = (nextReports: ApiReport[], nextSelectedId?: number) =>
    view.rerender(
      <ReportList
        groups={groupReports(nextReports)}
        selectedId={nextSelectedId}
        onSelect={onSelect}
      />,
    );
  return { onSelect, rerender };
}

const heading = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name},`) });

/** The titles of the reports listed (not collapsed) under a category. */
const titlesIn = (group: string) =>
  within(screen.getByRole('group', { name: group }))
    .queryAllByRole('button')
    .filter((button) => !button.hasAttribute('aria-expanded'))
    .map((button) => button.textContent);

describe('ReportList', () => {
  it('heads each category with its report count, expanded', () => {
    setup();

    expect(heading('Finance')).toHaveAccessibleName('Finance, 2 reports');
    expect(heading('Rooming')).toHaveAccessibleName('Rooming, 1 report');
    expect(heading('Uncategorised')).toHaveAttribute('aria-expanded', 'true');
    expect(titlesIn('Finance')).toEqual(['Balances', 'Payments']);
  });

  it('indents the reports under their heading', () => {
    setup();

    const list = document.getElementById(heading('Finance').getAttribute('aria-controls')!);
    expect(list).toContainElement(screen.getByRole('button', { name: 'Payments' }));
    expect(list).toHaveStyle({ paddingLeft: 'var(--mantine-spacing-xl)' });
  });

  it('collapses and expands a category, keeping its heading and count', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(heading('Finance'));
    expect(heading('Finance')).toHaveAttribute('aria-expanded', 'false');
    expect(heading('Finance')).toHaveAccessibleName('Finance, 2 reports');
    expect(titlesIn('Finance')).toEqual([]);
    expect(titlesIn('Rooming')).toEqual(['Rooms']);

    await user.click(heading('Finance'));
    expect(heading('Finance')).toHaveAttribute('aria-expanded', 'true');
    expect(titlesIn('Finance')).toEqual(['Balances', 'Payments']);
  });

  it('collapses the uncategorised reports too', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(heading('Uncategorised'));
    expect(titlesIn('Uncategorised')).toEqual([]);
  });

  it('collapses and expands from the keyboard', async () => {
    const user = userEvent.setup();
    setup();

    heading('Rooming').focus();
    await user.keyboard('{Enter}');
    expect(titlesIn('Rooming')).toEqual([]);
    await user.keyboard(' ');
    expect(titlesIn('Rooming')).toEqual(['Rooms']);
  });

  it('chooses a report', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup();

    await user.click(screen.getByRole('button', { name: 'Rooms' }));
    expect(onSelect).toHaveBeenCalledWith(REPORTS[2]);
  });

  it("opens the selected report's category when another report is selected", async () => {
    const user = userEvent.setup();
    const { rerender } = setup(REPORTS, 1);

    await user.click(heading('Rooming'));
    rerender(REPORTS, 3);
    expect(heading('Rooming')).toHaveAttribute('aria-expanded', 'true');
    expect(titlesIn('Rooming')).toEqual(['Rooms']);
  });

  it("opens the category a report is added to or moved into, once it's selected", async () => {
    const user = userEvent.setup();
    const { rerender } = setup(REPORTS, 1);

    await user.click(heading('Rooming'));
    await user.click(heading('Uncategorised'));

    // Added to Rooming: selected before the list has it, then listed.
    rerender(REPORTS, 9);
    rerender([...REPORTS, report(9, 'Cabins', 'Rooming')], 9);
    expect(titlesIn('Rooming')).toEqual(['Cabins', 'Rooms']);

    // Payments moved out of Finance into the (collapsed) uncategorised group.
    rerender([...REPORTS.filter((r) => r.id !== 1), report(1, 'Payments')], 1);
    expect(titlesIn('Uncategorised')).toEqual(['Payments', 'Summary']);
  });

  it("lets the selected report's category be collapsed", async () => {
    const user = userEvent.setup();
    setup(REPORTS, 1);

    await user.click(heading('Finance'));
    expect(titlesIn('Finance')).toEqual([]);
  });

  it('shows no headings to collapse, and no indent, when no report has a category', () => {
    setup([report(1, 'b'), report(2, 'A')]);

    expect(screen.queryByRole('button', { expanded: true })).not.toBeInTheDocument();
    expect(titlesIn('Uncategorised')).toEqual(['A', 'b']);
    expect(screen.getByRole('button', { name: 'A' }).parentElement).not.toHaveStyle({
      paddingLeft: 'var(--mantine-spacing-xl)',
    });
  });

  it('says when there are no reports', () => {
    setup([]);

    expect(screen.getByText('No reports yet.')).toBeInTheDocument();
  });
});
