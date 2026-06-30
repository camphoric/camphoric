/**
 * Campers (SPEC §8.5). A sortable/filterable table of the event's campers
 * (name, registration, lodging, accommodation/camp preferences); selecting one
 * (URL-addressable via `?camperId`) opens its editor.
 *
 * Admin-only attributes, lodging stay, and custom charges are later slices.
 */

import { Stack, Title } from '@mantine/core';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import type { ApiCamper, Hash } from 'api-types';
import { DataTable } from 'components/DataTable';
import { FullScreenLoading } from 'components/Loading';
import { useReportTemplateVars } from 'hooks/useReportData';
import { useMemo } from 'react';
import { eventHooks } from 'store/entities';
import { tableStateFromSearch, tableStateToSearch } from 'utils/tableUrlState';

import { CamperEdit } from './CamperEdit';

const FROM = '/admin/organization/$organizationId/event/$eventId';

/** Read a nested string/number attribute, blank if absent or non-primitive. */
function getStr(obj: Hash, path: string[]): string {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur && typeof cur === 'object') cur = (cur as Hash)[key];
    else return '';
  }
  return typeof cur === 'string' || typeof cur === 'number' ? String(cur) : '';
}

const camperName = (c: ApiCamper) =>
  `${getStr(c.attributes, ['first_name'])} ${getStr(c.attributes, ['last_name'])}`.trim();

export function EventAdminCampers() {
  const { organizationId, eventId } = useParams({ from: FROM });
  const search = useSearch({ from: FROM });
  const camperId = search.camperId;
  const navigate = useNavigate();
  const vars = useReportTemplateVars(eventId);
  const { data: event } = eventHooks.useById(eventId);

  const goToCampers = (patch: Record<string, string | undefined>) =>
    void navigate({
      to: '/admin/organization/$organizationId/event/$eventId/campers',
      params: { organizationId, eventId },
      search: (prev) => ({ ...prev, ...patch }),
    });

  const select = (id?: number) => goToCampers({ camperId: id ? String(id) : undefined });

  const tableState = useMemo(() => tableStateFromSearch(search, 'cam'), [search]);

  const registrationEmail = (c: ApiCamper) =>
    vars?.registrationLookup[String(c.registration)]?.registrant_email ?? '';
  const lodgingPath = (c: ApiCamper) =>
    c.lodging == null ? 'Unassigned' : (vars?.lodgingLookup[String(c.lodging)]?.fullPath ?? '');

  const columns = useMemo<ColumnDef<ApiCamper, unknown>[]>(
    () => [
      { id: 'name', header: 'Name', accessorFn: camperName },
      { id: 'registration', header: 'Registration', accessorFn: registrationEmail },
      { id: 'lodging', header: 'Lodging', accessorFn: lodgingPath },
      {
        id: 'accommodation',
        header: 'Accommodation',
        accessorFn: (c) => getStr(c.attributes, ['accommodations', 'accommodation_preference']),
      },
      {
        id: 'camp',
        header: 'Camp',
        accessorFn: (c) => getStr(c.attributes, ['accommodations', 'camp_preference']),
      },
    ],
    // registrationEmail/lodgingPath close over `vars`; recompute when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vars],
  );

  if (!vars || !event) return <FullScreenLoading />;

  const selected = vars.campers.find((c) => String(c.id) === camperId);

  return (
    <Stack>
      <Title order={2}>Campers</Title>
      <DataTable
        data={vars.campers}
        columns={columns}
        searchKeys={[camperName, registrationEmail, lodgingPath]}
        searchPlaceholder="Search campers…"
        onRowClick={(c) => select(c.id)}
        isRowSelected={(c) => String(c.id) === camperId}
        emptyMessage="No campers yet."
        state={tableState}
        onStateChange={(next) => goToCampers(tableStateToSearch(next, 'cam'))}
      />
      {selected && (
        <CamperEdit
          event={event}
          camper={selected}
          name={camperName(selected)}
          onDeleted={() => select(undefined)}
        />
      )}
    </Stack>
  );
}
