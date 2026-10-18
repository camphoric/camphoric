/**
 * Story for the DataTable (SPEC §8.2, DR-19). Exercises sorting, the
 * global fuzzy filter, pagination, and row selection, with the table's state
 * held locally or, as the admin screens do, in URL search params. Run
 * `npm run storybook`.
 */

import { Stack, Title } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { useState } from 'react';
import { tableStateFromSearch, tableStateToSearch } from 'utils/tableUrlState';

import { DataTable, type DataTableColumnDef } from '../DataTable';

interface Person {
  id: number;
  name: string;
  role: string;
  age: number;
}

const PEOPLE: Person[] = Array.from({ length: 45 }, (_, i) => ({
  id: i + 1,
  name: ['Bob', 'Abby', 'Xander', 'Willow', 'Malcolm', 'Zoe'][i % 6] + ` ${i + 1}`,
  role: ['Camper', 'Staff', 'Volunteer'][i % 3],
  age: 8 + (i % 50),
}));

const columns: DataTableColumnDef<Person>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'age', header: 'Age' },
];

export default { title: 'Data Table' } satisfies Meta;

export const Basic: StoryFn = () => {
  const [selectedId, setSelectedId] = useState<number>();
  return (
    <Stack maw={640} p="md">
      <Title order={4}>People</Title>
      <DataTable
        data={PEOPLE}
        columns={columns}
        searchKeys={['name', 'role']}
        pageSize={10}
        onRowClick={(p) => setSelectedId(p.id)}
        isRowSelected={(p) => p.id === selectedId}
      />
    </Stack>
  );
};

/**
 * State held as search params and parsed back on every change, as the admin
 * screens do (DR-2); the params are shown under the table.
 */
export const UrlState: StoryFn = () => {
  const [search, setSearch] = useState<Record<string, string | undefined>>({});
  return (
    <Stack maw={640} p="md">
      <Title order={4}>People</Title>
      <DataTable
        data={PEOPLE}
        columns={columns}
        searchKeys={['name', 'role']}
        pageSize={10}
        state={tableStateFromSearch(search, 'p')}
        onStateChange={(next) =>
          setSearch((prev) => ({ ...prev, ...tableStateToSearch(next, 'p') }))
        }
      />
      <pre data-testid="search">{JSON.stringify(search)}</pre>
    </Stack>
  );
};

export const Empty: StoryFn = () => (
  <Stack maw={640} p="md">
    <DataTable data={[]} columns={columns} emptyMessage="No people yet." />
  </Stack>
);
