/**
 * Ladle story for the DataTable (SPEC §8.2, DR-19). Exercises sorting, the
 * global fuzzy filter, pagination, and row selection. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Stack, Title } from '@mantine/core';
import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';

import { DataTable } from './DataTable';

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

const columns: ColumnDef<Person, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'age', header: 'Age' },
];

export const Basic: Story = () => {
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

export const Empty: Story = () => (
  <Stack maw={640} p="md">
    <DataTable data={[]} columns={columns} emptyMessage="No people yet." />
  </Stack>
);
