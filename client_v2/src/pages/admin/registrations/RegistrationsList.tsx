/**
 * The registrations list + editor (SPEC §8.4). A sortable/filterable table of
 * the event's registrations (primary camper, type, email, owed, balance, payment
 * status); selecting one (URL-addressable via `?registrationId`) opens its
 * editor. Rendered as the "Registrations" tab of the section.
 */

import { Badge, Stack } from '@mantine/core';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import type { ApiCamper, AugmentedRegistration } from 'api-types';
import { DataTable } from 'components/DataTable';
import { FullScreenLoading } from 'components/Loading';
import { useAugmentedRegistrations, useRegistrationTypeLookup } from 'hooks/useAdminData';
import { useMemo } from 'react';
import { eventHooks } from 'store/entities';
import { formatMoney } from 'utils/money';

import { RegistrationEdit } from './RegistrationEdit';

const FROM = '/admin/organization/$organizationId/event/$eventId';

/** Coerce a JSON attribute value to a string only when it's a primitive. */
const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');

const camperName = (c?: ApiCamper) =>
  c ? `${str(c.attributes.first_name)} ${str(c.attributes.last_name)}`.trim() : '';

type PaymentStatus = 'Paid' | 'Partial' | 'Unpaid';

function paymentStatus(r: AugmentedRegistration): PaymentStatus {
  if (r.total_balance <= 0) return 'Paid';
  if (r.total_payments > 0) return 'Partial';
  return 'Unpaid';
}

const STATUS_COLOR: Record<PaymentStatus, string> = {
  Paid: 'green',
  Partial: 'yellow',
  Unpaid: 'red',
};

export function RegistrationsList() {
  const { organizationId, eventId } = useParams({ from: FROM });
  const { registrationId } = useSearch({ from: FROM });
  const navigate = useNavigate();
  const registrations = useAugmentedRegistrations(eventId);
  const registrationTypes = useRegistrationTypeLookup(eventId);
  const { data: event } = eventHooks.useById(eventId);

  const select = (id?: number) =>
    void navigate({
      to: '/admin/organization/$organizationId/event/$eventId/registrations',
      params: { organizationId, eventId },
      search: (prev) => ({ ...prev, registrationId: id ? String(id) : undefined }),
    });

  const columns = useMemo<ColumnDef<AugmentedRegistration, unknown>[]>(
    () => [
      { id: 'camper', header: 'Primary camper', accessorFn: (r) => camperName(r.campers[0]) },
      { id: 'type', header: 'Type', accessorFn: (r) => r.registrationType?.label ?? '—' },
      { accessorKey: 'registrant_email', header: 'Email' },
      {
        id: 'owed',
        header: 'Owed',
        accessorFn: (r) => r.total_owed,
        cell: (info) => formatMoney(info.getValue<number>()),
      },
      {
        id: 'balance',
        header: 'Balance',
        accessorFn: (r) => r.total_balance,
        cell: (info) => formatMoney(info.getValue<number>()),
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (r) => paymentStatus(r),
        cell: (info) => {
          const status = info.getValue<PaymentStatus>();
          return <Badge color={STATUS_COLOR[status]}>{status}</Badge>;
        },
      },
    ],
    [],
  );

  if (!registrations || !registrationTypes || !event) return <FullScreenLoading />;

  const selected = registrations.find((r) => String(r.id) === registrationId);

  return (
    <Stack>
      <DataTable
        data={registrations}
        columns={columns}
        searchKeys={[
          'registrant_email',
          (r) => r.campers.map(camperName),
          (r) => r.registrationType?.label ?? '',
        ]}
        searchPlaceholder="Search registrations…"
        onRowClick={(r) => select(r.id)}
        isRowSelected={(r) => String(r.id) === registrationId}
        emptyMessage="No registrations yet."
      />
      {selected && (
        <RegistrationEdit
          event={event}
          registration={selected}
          registrationTypes={registrationTypes}
          onDeleted={() => select(undefined)}
        />
      )}
    </Stack>
  );
}
