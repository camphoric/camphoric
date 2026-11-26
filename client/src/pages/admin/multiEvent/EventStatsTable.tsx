/**
 * The included events side by side (SPEC §8.12; §15 DR-180): each event's
 * campers, registrations and people, how many were new and how many had come
 * before, the money received for it (payments less refunds), and how many of
 * the people at the event before it in its series came back to it.
 */

import { Table, Text } from '@mantine/core';
import type { ApiMultiEventStatsEvent } from 'api-types';
import { formatMoney } from 'utils/money';

export function retention(row: ApiMultiEventStatsEvent): string {
  const previous = row.previous;
  // Nobody was at the event before (or there's none): nothing to come back from.
  if (!previous?.people) return '—';
  const rate = Math.round((100 * previous.returned) / previous.people);
  return `${previous.returned} of ${previous.people} (${rate}%) from ${previous.name}`;
}

export function EventStatsTable({ rows }: { rows: ApiMultiEventStatsEvent[] }) {
  if (rows.length === 0) return <Text c="dimmed">No included events.</Text>;
  return (
    <Table.ScrollContainer minWidth={820}>
      <Table striped verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Event</Table.Th>
            <Table.Th>Series</Table.Th>
            <Table.Th>Year</Table.Th>
            <Table.Th ta="right">Campers</Table.Th>
            <Table.Th ta="right">Registrations</Table.Th>
            <Table.Th ta="right">People</Table.Th>
            <Table.Th ta="right">New</Table.Th>
            <Table.Th ta="right">Returning</Table.Th>
            <Table.Th ta="right">Received</Table.Th>
            <Table.Th>Came back</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.event}>
              <Table.Td>{row.name}</Table.Td>
              <Table.Td>{row.series}</Table.Td>
              <Table.Td>{row.year ?? ''}</Table.Td>
              <Table.Td ta="right">{row.campers}</Table.Td>
              <Table.Td ta="right">{row.registrations}</Table.Td>
              <Table.Td ta="right">{row.people}</Table.Td>
              <Table.Td ta="right">{row.new}</Table.Td>
              <Table.Td ta="right">{row.returning}</Table.Td>
              <Table.Td ta="right">{formatMoney(row.received)}</Table.Td>
              <Table.Td>{retention(row)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
