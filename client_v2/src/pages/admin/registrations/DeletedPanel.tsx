/**
 * The event's deleted registrations, campers and payments (SPEC §8.4; §15,
 * DR-55), for Registrars and Admins: each with when and by whom it was deleted,
 * and Restore. A deleted registration takes its campers and payments with it and
 * brings them back when it's restored, so those aren't listed on their own.
 * Rendered as the "Deleted" tab of the Registrations section.
 */

import { Button, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useParams } from '@tanstack/react-router';
import type { ApiActor, Scalar } from 'api-types';
import { InlineLoading } from 'components/Loading';
import type { ReactNode } from 'react';
import {
  type RestorablePath,
  useDeletedCampers,
  useDeletedPayments,
  useDeletedRegistrations,
  useRestore,
} from 'store/deletes';
import { registrationHooks } from 'store/entities';
import { camperName } from 'utils/camper';
import { formatMoney } from 'utils/money';

const FROM = '/admin/organization/$organizationId/event/$eventId';

export function DeletedPanel() {
  const { eventId } = useParams({ from: FROM });
  const registrations = useDeletedRegistrations(eventId);
  const campers = useDeletedCampers(eventId);
  const payments = useDeletedPayments({ event: eventId });
  const { data: live } = registrationHooks.useList({ event: eventId });

  if (!registrations.data || !campers.data || !payments.data) return <InlineLoading />;

  const emailOf = Object.fromEntries((live ?? []).map((r) => [String(r.id), r.registrant_email]));
  const registrationOf = (id: Scalar) => emailOf[String(id)] ?? `#${id}`;

  return (
    <Stack gap="lg">
      <Text size="sm" c="dimmed">
        Deleted registrations, campers and payments stay here until they’re restored. A deleted
        registration’s campers and payments come back with it.
      </Text>

      <Section
        title="Registrations"
        path="registrations"
        empty="No deleted registrations."
        headings={['Registrant', 'Campers']}
        rows={registrations.data.map((r) => ({
          id: r.id,
          name: r.registrant_email,
          cells: [r.registrant_email, r.camper_count],
          deleted_at: r.deleted_at,
          deleted_by: r.deleted_by,
        }))}
      />
      <Section
        title="Campers"
        path="campers"
        empty="No campers deleted on their own."
        headings={['Camper', 'Registration']}
        rows={campers.data.map((c) => ({
          id: c.id,
          name: camperName(c),
          cells: [camperName(c), registrationOf(c.registration)],
          deleted_at: c.deleted_at,
          deleted_by: c.deleted_by,
        }))}
      />
      <Section
        title="Payments"
        path="payments"
        empty="No payments deleted on their own."
        headings={['Payment', 'Registration']}
        rows={payments.data.map((p) => ({
          id: p.id,
          name: `the ${p.payment_type} payment of ${formatMoney(p.amount)}`,
          cells: [
            `${p.payment_type} ${formatMoney(p.amount)}${p.paid_on ? `, paid ${p.paid_on}` : ''}`,
            registrationOf(p.registration),
          ],
          deleted_at: p.deleted_at,
          deleted_by: p.deleted_by,
        }))}
      />
    </Stack>
  );
}

interface Row {
  id: number;
  /** For the notification, e.g. "pat@example.com". */
  name: string;
  cells: ReactNode[];
  deleted_at: string;
  deleted_by: ApiActor | null;
}

function Section({
  title,
  path,
  empty,
  headings,
  rows,
}: {
  title: string;
  path: RestorablePath;
  empty: string;
  headings: string[];
  rows: Row[];
}) {
  const restore = useRestore(path);
  return (
    <Stack gap="xs">
      <Title order={4}>{title}</Title>
      {rows.length === 0 ? (
        <Text size="sm" c="dimmed">
          {empty}
        </Text>
      ) : (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              {headings.map((heading) => (
                <Table.Th key={heading}>{heading}</Table.Th>
              ))}
              <Table.Th>Deleted</Table.Th>
              <Table.Th>By</Table.Th>
              <Table.Th aria-label="Actions" />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.id}>
                {row.cells.map((cell, index) => (
                  <Table.Td key={headings[index]}>{cell}</Table.Td>
                ))}
                <Table.Td>{new Date(row.deleted_at).toLocaleString()}</Table.Td>
                <Table.Td>{row.deleted_by?.name ?? '—'}</Table.Td>
                <Table.Td>
                  <Button
                    size="compact-sm"
                    variant="light"
                    aria-label={`Restore ${row.name}`}
                    loading={restore.isPending && restore.variables === row.id}
                    onClick={() =>
                      restore.mutate(row.id, {
                        onSuccess: () =>
                          notifications.show({ color: 'green', message: `Restored ${row.name}.` }),
                      })
                    }
                  >
                    Restore
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
