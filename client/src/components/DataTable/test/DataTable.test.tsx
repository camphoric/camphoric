import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { renderWithProviders, screen } from 'test/utils';
import { tableStateFromSearch, tableStateToSearch } from 'utils/tableUrlState';
import { describe, expect, it } from 'vitest';

import { DataTable, type DataTableColumnDef } from '../DataTable';

interface Person {
  id: number;
  name: string;
}

const people = (count: number): Person[] =>
  Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Person ${i + 1}` }));

/** The text of each body row's first cell, top to bottom. */
const firstCells = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelector('td')?.textContent);

const columns: DataTableColumnDef<Person>[] = [{ accessorKey: 'name', header: 'Name' }];

/**
 * Holds the table's state the way an admin screen does: written to search
 * params and parsed back on every render, so each change yields fresh objects.
 */
function UrlTable({ data, initialPage }: { data: Person[]; initialPage?: string }) {
  const [search, setSearch] = useState<Record<string, string | undefined>>({
    tpage: initialPage,
  });
  return (
    <DataTable
      data={data}
      columns={columns}
      pageSize={10}
      state={tableStateFromSearch(search, 't')}
      onStateChange={(next) => setSearch((prev) => ({ ...prev, ...tableStateToSearch(next, 't') }))}
    />
  );
}

describe('DataTable', () => {
  it('advances to the next page when its state lives in the URL', async () => {
    renderWithProviders(<UrlTable data={people(25)} />);
    expect(screen.getByRole('cell', { name: 'Person 1' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByRole('cell', { name: 'Person 11' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Person 1' })).not.toBeInTheDocument();
  });

  it('returns to the first page when the filter changes', async () => {
    renderWithProviders(<UrlTable data={people(25)} initialPage="2" />);
    expect(screen.getByRole('cell', { name: 'Person 11' })).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Search…'), 'Person 2');
    expect(screen.getByRole('cell', { name: 'Person 2' })).toBeInTheDocument();
  });

  it('stays on its page when the rows are refreshed', () => {
    const { rerender } = renderWithProviders(<UrlTable data={people(25)} initialPage="2" />);
    rerender(<UrlTable data={people(25)} initialPage="2" />);
    expect(screen.getByRole('cell', { name: 'Person 11' })).toBeInTheDocument();
  });

  it('sorts a text column ascending, in natural order, then descending', async () => {
    renderWithProviders(<DataTable data={people(12)} columns={columns} />);

    await userEvent.click(screen.getByRole('columnheader', { name: 'Name' }));
    expect(firstCells().slice(0, 3)).toEqual(['Person 1', 'Person 2', 'Person 3']);

    await userEvent.click(screen.getByRole('columnheader', { name: 'Name' }));
    expect(firstCells().slice(0, 3)).toEqual(['Person 12', 'Person 11', 'Person 10']);
  });

  it('sorts a number column largest first on its first click', async () => {
    const byId: DataTableColumnDef<Person>[] = [{ accessorKey: 'id', header: 'Id' }];
    renderWithProviders(<DataTable data={people(3)} columns={byId} />);

    await userEvent.click(screen.getByRole('columnheader', { name: 'Id' }));
    expect(firstCells()).toEqual(['3', '2', '1']);
  });

  it('returns to the first page when re-sorted', async () => {
    renderWithProviders(<UrlTable data={people(25)} initialPage="2" />);
    expect(screen.getByRole('cell', { name: 'Person 11' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('columnheader', { name: 'Name' }));
    expect(firstCells()[0]).toBe('Person 1');
  });

  it('shows the last page when the URL names a page past the end', () => {
    renderWithProviders(<UrlTable data={people(25)} initialPage="9" />);
    expect(screen.getByRole('cell', { name: 'Person 21' })).toBeInTheDocument();
  });
});
