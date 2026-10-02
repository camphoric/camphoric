/**
 * The registrations list + editor (SPEC §8.4). A sortable/filterable table of
 * the event's registrations (primary camper, type, email, owed, balance, payment
 * status); selecting one (URL-addressable via `?registrationId`) opens its
 * editor. Rendered as the "Registrations" tab of the section.
 *
 * A registration is listed once its registrant pressed a payment button (§15,
 * DR-91), paid or not. One whose PayPal or card payment didn't go through says
 * so; one owed money back shows "Refund due".
 */

import { Badge, Group, Modal, Stack, Tooltip } from '@mantine/core';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import type { ApiCamper, ApiInvoice, AugmentedRegistration } from 'api-types';
import { DataTable } from 'components/DataTable';
import { FullScreenLoading } from 'components/Loading';
import { useAugmentedRegistrations, useRegistrationTypeLookup } from 'hooks/useAdminData';
import { EDITOR_MODAL_SIZE, editorModalStyles } from 'pages/admin/editorModalStyles';
import { useMemo } from 'react';
import { eventHooks, invoiceHooks } from 'store/entities';
import { formatMoney } from 'utils/money';
import { tableStateFromSearch, tableStateToSearch } from 'utils/tableUrlState';

import { RegistrationEdit } from './RegistrationEdit';

const FROM = '/admin/organization/$organizationId/event/$eventId';

/** Coerce a JSON attribute value to a string only when it's a primitive. */
const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');

const camperName = (c?: ApiCamper) =>
  c ? `${str(c.attributes.first_name)} ${str(c.attributes.last_name)}`.trim() : '';

type PaymentStatus = 'Paid' | 'Partial' | 'Unpaid' | 'Refund due';

function paymentStatus(r: AugmentedRegistration): PaymentStatus {
  if (r.total_balance < 0) return 'Refund due';
  if (r.total_balance === 0) return 'Paid';
  if (r.total_payments > 0) return 'Partial';
  return 'Unpaid';
}

const STATUS_COLOR: Record<PaymentStatus, string> = {
  Paid: 'green',
  Partial: 'yellow',
  Unpaid: 'red',
  'Refund due': 'orange',
};

/**
 * Registrations whose registrant started paying online and it didn't go
 * through: their registration invoice is to be paid by PayPal or card, and
 * nothing has been paid on it.
 */
function onlineNotFinished(invoices: ApiInvoice[] | undefined): Set<number> {
  return new Set(
    (invoices ?? [])
      .filter(
        (i) =>
          i.origin === 'registration' &&
          (i.payment_type === 'PayPal' || i.payment_type === 'Card') &&
          i.status === 'open',
      )
      .map((i) => Number(i.registration)),
  );
}

export function RegistrationsList() {
  const { organizationId, eventId } = useParams({ from: FROM });
  const search = useSearch({ from: FROM });
  const registrationId = search.registrationId;
  const navigate = useNavigate();
  const registrations = useAugmentedRegistrations(eventId);
  const registrationTypes = useRegistrationTypeLookup(eventId);
  const { data: event } = eventHooks.useById(eventId);
  const { data: invoices } = invoiceHooks.useList({
    registration__event: eventId,
    registration__completed: 1,
  });
  const notFinished = useMemo(() => onlineNotFinished(invoices), [invoices]);

  const goToRegistrations = (patch: Record<string, string | undefined>) =>
    void navigate({
      to: '/admin/organization/$organizationId/event/$eventId/registrations',
      params: { organizationId, eventId },
      search: (prev) => ({ ...prev, ...patch }),
    });

  const select = (id?: number) =>
    goToRegistrations({ registrationId: id ? String(id) : undefined });

  const tableState = useMemo(() => tableStateFromSearch(search, 'reg'), [search]);

  const columns = useMemo<ColumnDef<AugmentedRegistration, unknown>[]>(
    () => [
      { id: 'camper', header: 'Primary camper', accessorFn: (r) => camperName(r.campers[0]) },
      { id: 'type', header: 'Type', accessorFn: (r) => r.registrationType?.label ?? '—' },
      { id: 'promo', header: 'Promo code', accessorFn: (r) => r.promo?.code ?? '—' },
      { accessorKey: 'registrant_email', header: 'Email' },
      {
        id: 'owed',
        header: 'Total',
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
          return (
            <Group gap={4} wrap="nowrap">
              <Badge color={STATUS_COLOR[status]}>{status}</Badge>
              {notFinished.has(info.row.original.id) && (
                <Tooltip label="They chose to pay online and it didn’t go through">
                  <Badge color="gray" variant="outline">
                    Online payment not finished
                  </Badge>
                </Tooltip>
              )}
            </Group>
          );
        },
      },
    ],
    [notFinished],
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
        state={tableState}
        onStateChange={(next) => goToRegistrations(tableStateToSearch(next, 'reg'))}
      />
      <Modal
        opened={!!selected}
        onClose={() => select(undefined)}
        title={selected?.registrant_email || 'Registration'}
        size={EDITOR_MODAL_SIZE}
        styles={editorModalStyles}
      >
        {selected && (
          <RegistrationEdit
            key={selected.id}
            event={event}
            registration={selected}
            registrationTypes={registrationTypes}
            onDeleted={() => select(undefined)}
          />
        )}
      </Modal>
    </Stack>
  );
}
