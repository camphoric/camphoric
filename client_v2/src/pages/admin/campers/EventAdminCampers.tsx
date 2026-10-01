/**
 * Campers (SPEC §8.5). A sortable/filterable table of the event's campers
 * (name, registration, lodging, the lodging they asked for, and the other
 * campers on the same registration); selecting one
 * (URL-addressable via `?camperId`) opens its editor.
 *
 * The editor's Lodging tab is read-only; setting the lodging stay from here is
 * a later slice.
 */

import { Modal, Stack, Title } from '@mantine/core';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import type { ApiCamper, Hash } from 'api-types';
import { DataTable } from 'components/DataTable';
import { FullScreenLoading } from 'components/Loading';
import { useReportTemplateVars } from 'hooks/useReportData';
import { editorModalStyles } from 'pages/admin/editorModalStyles';
import { useMemo } from 'react';
import { eventHooks } from 'store/entities';
import { tableStateFromSearch, tableStateToSearch } from 'utils/tableUrlState';

import { CamperEdit } from './CamperEdit';
import { assignedLodgingPath } from './lodgingPath';

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

  /** The lodging screen's hierarchy, with the camper's details open (SPEC §8.6). */
  const openLodging = (id: number) =>
    void navigate({
      to: '/admin/organization/$organizationId/event/$eventId/lodging',
      params: { organizationId, eventId },
      search: { camperId: String(id) },
    });

  const tableState = useMemo(() => tableStateFromSearch(search, 'cam'), [search]);

  const registrationEmail = (c: ApiCamper) =>
    vars?.registrationLookup[String(c.registration)]?.registrant_email ?? '';
  // Each registration's campers, for "Other campers".
  const campersByRegistration = useMemo(() => {
    const byRegistration = new Map<string, ApiCamper[]>();
    for (const camper of vars?.campers ?? []) {
      const key = String(camper.registration);
      byRegistration.set(key, [...(byRegistration.get(key) ?? []), camper]);
    }
    return byRegistration;
  }, [vars]);
  const otherCampers = (c: ApiCamper) =>
    (campersByRegistration.get(String(c.registration)) ?? [])
      .filter((other) => other.id !== c.id)
      .map(camperName)
      .join(', ');
  const lodgingPath = (c: ApiCamper) => (vars ? assignedLodgingPath(c, vars.lodgingLookup) : '');
  const requestedPath = (c: ApiCamper) =>
    c.lodging_requested == null
      ? ''
      : (vars?.lodgingLookup[String(c.lodging_requested)]?.fullPath ?? '');

  const columns = useMemo<ColumnDef<ApiCamper, unknown>[]>(
    () => [
      { id: 'name', header: 'Name', accessorFn: camperName },
      { id: 'registration', header: 'Registration', accessorFn: registrationEmail },
      { id: 'lodging', header: 'Lodging', accessorFn: lodgingPath },
      { id: 'requested', header: 'Requested lodging', accessorFn: requestedPath },
      { id: 'others', header: 'Other campers', accessorFn: otherCampers },
    ],
    // The accessors close over `vars`; recompute when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vars, campersByRegistration],
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
      <Modal
        opened={!!selected}
        onClose={() => select(undefined)}
        title={selected ? camperName(selected) || 'Camper' : ''}
        size="xl"
        styles={editorModalStyles}
      >
        {selected && (
          <CamperEdit
            key={selected.id}
            event={event}
            camper={selected}
            name={camperName(selected)}
            lodgingLookup={vars.lodgingLookup}
            onDeleted={() => select(undefined)}
            onSelectCamper={select}
            onOpenLodging={openLodging}
          />
        )}
      </Modal>
    </Stack>
  );
}
