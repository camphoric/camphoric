import type { ColumnDef } from '@tanstack/react-table';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { renderWithProviders, screen } from 'test/utils';
import { tableStateFromSearch, tableStateToSearch } from 'utils/tableUrlState';
import { describe, expect, it } from 'vitest';

import { DataTable } from '../DataTable';

interface Person {
  id: number;
  name: string;
}

const people = (count: number): Person[] =>
  Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Person ${i + 1}` }));

const columns: ColumnDef<Person, unknown>[] = [{ accessorKey: 'name', header: 'Name' }];

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

  it('shows the last page when the URL names a page past the end', () => {
    renderWithProviders(<UrlTable data={people(25)} initialPage="9" />);
    expect(screen.getByRole('cell', { name: 'Person 21' })).toBeInTheDocument();
  });
});
