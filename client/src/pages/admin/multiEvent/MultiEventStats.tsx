/**
 * Multi-event reports' Stats section (SPEC §8.12; §15 DR-180): across the
 * included events, or one series (`?series`), the events side by side — new and
 * returning people, and how many came back from the event before — and each
 * person's attendance (`?statsTab=people`): how many events, the first and most
 * recent, and the most consecutive years. Selecting a person opens their record
 * in People.
 */

import { Select, Stack, Tabs, Text, Title } from '@mantine/core';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { ApiMultiEventStatsPerson } from 'api-types';
import { DataTable, type DataTableColumnDef } from 'components/DataTable';
import { InlineLoading } from 'components/Loading';
import { useMemo } from 'react';
import { useMultiEventStats } from 'store/multiEvent';
import { tableStateFromSearch, tableStateToSearch } from 'utils/tableUrlState';

import { EventStatsTable } from './EventStatsTable';

const FROM = '/admin/organization/$organizationId/multi-event';

export function MultiEventStats() {
  const { organizationId } = useParams({ from: FROM });
  const search = useSearch({ from: FROM });
  const navigate = useNavigate();
  const series = search.series ?? '';
  const stats = useMultiEventStats(organizationId, series);

  const setSearch = (patch: Record<string, string | undefined>) =>
    void navigate({
      to: '/admin/organization/$organizationId/multi-event/stats',
      params: { organizationId },
      search: (prev) => ({ ...prev, ...patch }),
    });

  const eventNames = useMemo(
    () => new Map((stats.data?.events ?? []).map((row) => [row.event, row.name])),
    [stats.data],
  );
  const eventOrder = useMemo(
    () => new Map((stats.data?.events ?? []).map((row, index) => [row.event, index])),
    [stats.data],
  );

  const columns = useMemo<DataTableColumnDef<ApiMultiEventStatsPerson>[]>(
    () => [
      { id: 'name', header: 'Name', accessorFn: (p) => p.name },
      { id: 'attended', header: 'Events attended', accessorFn: (p) => p.attended },
      {
        id: 'first',
        header: 'First',
        accessorFn: (p) => eventOrder.get(p.first_event) ?? -1,
        cell: (info) => eventNames.get(info.row.original.first_event) ?? '',
      },
      {
        id: 'last',
        header: 'Most recent',
        accessorFn: (p) => eventOrder.get(p.last_event) ?? -1,
        cell: (info) => eventNames.get(info.row.original.last_event) ?? '',
      },
      { id: 'run', header: 'Consecutive years', accessorFn: (p) => p.longest_run },
    ],
    [eventNames, eventOrder],
  );

  const openPerson = (row: ApiMultiEventStatsPerson) =>
    void navigate({
      to: '/admin/organization/$organizationId/multi-event/people',
      params: { organizationId },
      search: row.person ? { personId: String(row.person) } : { camperId: String(row.campers[0]) },
    });

  const tab = search.statsTab === 'people' ? 'people' : 'events';
  const seriesNames = stats.data?.series ?? [];

  return (
    <Stack>
      <Title order={2}>Stats</Title>
      {seriesNames.length > 0 && (
        <Select
          label="Series"
          style={{ maxWidth: 280 }}
          data={[{ value: '', label: 'All included events' }, ...seriesNames]}
          value={series}
          allowDeselect={false}
          onChange={(value) => setSearch({ series: value || undefined, attpage: undefined })}
        />
      )}
      <Text size="sm" c="dimmed" maw={760}>
        People are linked people, and each camper record linked to no one counted on its own, so a
        returning camper whose records aren’t linked yet counts as new. “Came back” compares each
        event with the one before it in its series.
      </Text>
      {!stats.data ? (
        <InlineLoading />
      ) : (
        <Tabs
          value={tab}
          onChange={(value) => setSearch({ statsTab: value === 'people' ? 'people' : undefined })}
        >
          <Tabs.List>
            <Tabs.Tab value="events">Events</Tabs.Tab>
            <Tabs.Tab value="people">Attendance</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="events" pt="md">
            <EventStatsTable rows={stats.data.events} />
          </Tabs.Panel>
          <Tabs.Panel value="people" pt="md">
            <DataTable
              data={stats.data.people}
              columns={columns}
              searchKeys={['name']}
              searchPlaceholder="Search people…"
              onRowClick={openPerson}
              emptyMessage="No camper records in the included events."
              state={tableStateFromSearch(search, 'att')}
              onStateChange={(next) => setSearch(tableStateToSearch(next, 'att'))}
            />
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  );
}
