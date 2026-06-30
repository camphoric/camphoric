/**
 * Reusable admin data table (SPEC §8.2, §8.4, §8.5; DR-19). Headless
 * `@tanstack/react-table` rendered with Mantine `Table` primitives: client-side
 * sorting, pagination, and a global fuzzy filter (match-sorter, DR-20) over the
 * full per-event dataset (small at this scale — DR-25).
 *
 * Rows are clickable for selection; the selected row is highlighted. Table state
 * (sort/filter/page) is component-local by default, or fully controlled via
 * `state`/`onStateChange` so a caller can hold it in URL search params (DR-2).
 */

import { Box, Group, Pagination, Table, Text, TextInput } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconSearch } from '@tabler/icons-react';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { matchSorter } from 'match-sorter';
import { useMemo, useState } from 'react';

/** A match-sorter key: an object path, or a function projecting searchable text. */
type SearchKey<T> = string | ((item: T) => string | string[]);

/** Controllable table state (sort / global filter / 0-based page). */
export interface DataTableState {
  sorting: SortingState;
  globalFilter: string;
  pageIndex: number;
}

const EMPTY_STATE: DataTableState = { sorting: [], globalFilter: '', pageIndex: 0 };

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  /** Keys searched by the global filter (match-sorter keys). */
  searchKeys?: SearchKey<T>[];
  onRowClick?: (row: T) => void;
  isRowSelected?: (row: T) => boolean;
  pageSize?: number;
  emptyMessage?: string;
  searchPlaceholder?: string;
  /** Controlled table state; omit for component-local state. */
  state?: DataTableState;
  onStateChange?: (next: DataTableState) => void;
}

export function DataTable<T>({
  data,
  columns,
  searchKeys,
  onRowClick,
  isRowSelected,
  pageSize = 20,
  emptyMessage = 'No records.',
  searchPlaceholder = 'Search…',
  state,
  onStateChange,
}: DataTableProps<T>) {
  const [internal, setInternal] = useState<DataTableState>(EMPTY_STATE);
  const controlled = state !== undefined;
  const current = controlled ? state : internal;

  const update = (next: DataTableState) => {
    if (controlled) onStateChange?.(next);
    else setInternal(next);
  };

  const filtered = useMemo(() => {
    const query = current.globalFilter.trim();
    if (!query || !searchKeys?.length) return data;
    return matchSorter(data, query, { keys: searchKeys });
  }, [data, current.globalFilter, searchKeys]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: {
      sorting: current.sorting,
      pagination: { pageIndex: current.pageIndex, pageSize },
    },
    onSortingChange: (updater) => {
      const sorting = typeof updater === 'function' ? updater(current.sorting) : updater;
      // Re-sorting returns to the first page.
      update({ ...current, sorting, pageIndex: 0 });
    },
    onPaginationChange: (updater) => {
      const pagination =
        typeof updater === 'function'
          ? updater({ pageIndex: current.pageIndex, pageSize })
          : updater;
      update({ ...current, pageIndex: pagination.pageIndex });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const pageCount = table.getPageCount();
  const rows = table.getRowModel().rows;

  return (
    <Box>
      <TextInput
        leftSection={<IconSearch size={16} />}
        placeholder={searchPlaceholder}
        value={current.globalFilter}
        // Filtering returns to the first page.
        onChange={(e) => update({ ...current, globalFilter: e.currentTarget.value, pageIndex: 0 })}
        mb="sm"
        maw={360}
      />
      <Table.ScrollContainer minWidth={500}>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            {table.getHeaderGroups().map((group) => (
              <Table.Tr key={group.id}>
                {group.headers.map((header) => {
                  const sortDir = header.column.getIsSorted();
                  return (
                    <Table.Th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      style={{ cursor: header.column.getCanSort() ? 'pointer' : undefined }}
                    >
                      <Group gap={4} wrap="nowrap">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortDir === 'asc' && <IconChevronUp size={14} />}
                        {sortDir === 'desc' && <IconChevronDown size={14} />}
                      </Group>
                    </Table.Th>
                  );
                })}
              </Table.Tr>
            ))}
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={columns.length}>
                  <Text c="dimmed" size="sm" ta="center" py="md">
                    {emptyMessage}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((row) => {
                const selected = isRowSelected?.(row.original) ?? false;
                return (
                  <Table.Tr
                    key={row.id}
                    onClick={() => onRowClick?.(row.original)}
                    bg={selected ? 'var(--mantine-primary-color-light)' : undefined}
                    style={{ cursor: onRowClick ? 'pointer' : undefined }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <Table.Td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {pageCount > 1 && (
        <Group justify="space-between" mt="sm">
          <Text size="sm" c="dimmed">
            {filtered.length} record{filtered.length === 1 ? '' : 's'}
          </Text>
          <Pagination
            size="sm"
            total={pageCount}
            value={table.getState().pagination.pageIndex + 1}
            onChange={(page) => table.setPageIndex(page - 1)}
          />
        </Group>
      )}
    </Box>
  );
}
