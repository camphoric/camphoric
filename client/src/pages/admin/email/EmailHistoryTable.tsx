/**
 * The event's email history as a table (SPEC §8.9): newest first, filtered by
 * status and kind and searched by recipient or subject on the server, 50 to a
 * page. Selecting a row opens that message.
 */

import {
  Badge,
  Group,
  Pagination,
  SegmentedControl,
  Select,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import type { ApiEmailMessage, Paginated } from 'api-types';
import { useEffect, useState } from 'react';
import type { EmailHistoryFilters } from 'store/email';

import {
  formatTime,
  KIND_FILTERS,
  KIND_LABEL,
  STATUS_COLOR,
  STATUS_FILTERS,
  STATUS_LABEL,
} from './emailLabels';

export const PAGE_SIZE = 50;

interface EmailHistoryTableProps {
  page: Paginated<ApiEmailMessage> | undefined;
  filters: EmailHistoryFilters;
  onFiltersChange: (filters: EmailHistoryFilters) => void;
  onOpen: (message: ApiEmailMessage) => void;
  selectedId?: number;
}

function statusCell(message: ApiEmailMessage) {
  const retrying = message.status === 'queued' && message.attempts > 0;
  return (
    <Badge size="sm" variant="light" color={retrying ? 'yellow' : STATUS_COLOR[message.status]}>
      {retrying ? `Retrying (${message.attempts} tried)` : STATUS_LABEL[message.status]}
    </Badge>
  );
}

export function EmailHistoryTable({
  page,
  filters,
  onFiltersChange,
  onOpen,
  selectedId,
}: EmailHistoryTableProps) {
  // Every change of filter returns to the first page.
  const change = (patch: EmailHistoryFilters) => onFiltersChange({ ...filters, ...patch, page: 1 });

  const [search, setSearch] = useState(filters.q ?? '');
  useEffect(() => setSearch(filters.q ?? ''), [filters.q]);
  const applySearch = useDebouncedCallback((q: string) => change({ q }), 400);

  const messages = page?.results ?? [];
  const pages = page ? Math.max(1, Math.ceil(page.count / PAGE_SIZE)) : 1;

  return (
    <>
      <Group mb="sm" gap="sm" wrap="wrap">
        <SegmentedControl
          size="xs"
          data={STATUS_FILTERS}
          value={filters.status ?? ''}
          onChange={(status) => change({ status })}
          aria-label="Status"
        />
        <Select
          size="xs"
          data={KIND_FILTERS}
          value={filters.kind ?? ''}
          onChange={(kind) => change({ kind: kind ?? '' })}
          allowDeselect={false}
          aria-label="Kind"
          w={220}
        />
        <TextInput
          size="xs"
          leftSection={<IconSearch size={14} />}
          placeholder="Search recipient or subject…"
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            applySearch(event.currentTarget.value);
          }}
          w={260}
        />
      </Group>

      <Table.ScrollContainer minWidth={640}>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>When</Table.Th>
              <Table.Th>Kind</Table.Th>
              <Table.Th>To</Table.Th>
              <Table.Th>Subject</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {messages.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" size="sm" ta="center" py="md">
                    {page ? 'No email matches.' : 'Loading…'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              messages.map((message) => (
                <Table.Tr
                  key={message.id}
                  onClick={() => onOpen(message)}
                  bg={message.id === selectedId ? 'var(--mantine-primary-color-light)' : undefined}
                  style={{ cursor: 'pointer' }}
                >
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    {formatTime(message.sent_at ?? message.created_at)}
                  </Table.Td>
                  <Table.Td>{KIND_LABEL[message.kind]}</Table.Td>
                  <Table.Td>{message.to}</Table.Td>
                  <Table.Td>{message.subject}</Table.Td>
                  <Table.Td>{statusCell(message)}</Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {page && page.count > 0 && (
        <Group justify="space-between" mt="sm">
          <Text size="sm" c="dimmed">
            {page.count} email{page.count === 1 ? '' : 's'}
          </Text>
          {pages > 1 && (
            <Pagination
              size="sm"
              total={pages}
              value={filters.page ?? 1}
              onChange={(pageNumber) => onFiltersChange({ ...filters, page: pageNumber })}
            />
          )}
        </Group>
      )}
    </>
  );
}
