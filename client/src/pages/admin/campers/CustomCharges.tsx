/**
 * A camper's custom charges, or a registration's own (SPEC §8.4, §8.5; §15,
 * DR-170): each with its date, type, amount and notes, and for Registrars and
 * Admins, adding one and removing one (after confirming). A registration's own
 * charges — a cancellation fee kept when a camper was deleted, say — are the
 * ones on no camper; they're added to its total.
 */

import { Button, Group, Stack, Table, Text } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import type { ApiCamper, ApiCustomCharge, Scalar } from 'api-types';
import { confirmDelete } from 'components/ConfirmDelete';
import { CanEdit } from 'hooks/permissions';
import { useState } from 'react';
import { customChargeHooks, customChargeTypeHooks } from 'store/entities';
import { formatMoney } from 'utils/money';

import { AddCustomChargeModal } from './AddCustomChargeModal';

interface CustomChargesProps {
  eventId: Scalar;
  registrationId: Scalar;
  /** For a camper's charges; leave out for the registration's own. */
  camper?: ApiCamper;
}

export function CustomCharges({ eventId, registrationId, camper }: CustomChargesProps) {
  const { data: listed } = customChargeHooks.useList(
    camper ? { camper: camper.id } : { registration: registrationId },
  );
  const { data: types } = customChargeTypeHooks.useList({ event: eventId });
  const del = customChargeHooks.useDelete();
  const [addOpen, setAddOpen] = useState(false);

  // A registration's list also has its campers' charges; those are on each camper.
  const charges = (listed ?? []).filter((cc) => (camper ? true : cc.camper == null));

  const typeLabel = (id: ApiCustomCharge['custom_charge_type']) =>
    types?.find((t) => String(t.id) === String(id))?.label ?? String(id);

  const confirmDeleteCharge = (cc: ApiCustomCharge) =>
    confirmDelete({
      path: 'customcharges',
      id: cc.id,
      title: 'Delete custom charge',
      message: (
        <>
          Delete {typeLabel(cc.custom_charge_type)} ({formatMoney(cc.amount)})?
        </>
      ),
      onConfirm: () => del.mutate({ id: cc.id, version: cc.version }),
    });

  return (
    <Stack gap="xs">
      {charges.length > 0 ? (
        <Table withTableBorder withColumnBorders striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Amount</Table.Th>
              <Table.Th>Notes</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {charges.map((cc) => (
              <Table.Tr key={cc.id}>
                <Table.Td>{cc.created_at.slice(0, 10)}</Table.Td>
                <Table.Td>{typeLabel(cc.custom_charge_type)}</Table.Td>
                <Table.Td>{formatMoney(cc.amount)}</Table.Td>
                <Table.Td>{cc.notes}</Table.Td>
                <Table.Td>
                  <CanEdit>
                    <Button
                      size="compact-sm"
                      variant="light"
                      color="red"
                      leftSection={<IconTrash size={14} />}
                      aria-label={`Delete charge: ${typeLabel(cc.custom_charge_type)} ${formatMoney(cc.amount)}`}
                      onClick={() => confirmDeleteCharge(cc)}
                    >
                      Delete
                    </Button>
                  </CanEdit>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text c="dimmed" size="sm">
          No custom charges.
        </Text>
      )}

      <CanEdit>
        <Group>
          <Button variant="light" onClick={() => setAddOpen(true)}>
            Add custom charge
          </Button>
        </Group>
      </CanEdit>

      <AddCustomChargeModal
        eventId={eventId}
        registrationId={registrationId}
        camper={camper}
        opened={addOpen}
        onClose={() => setAddOpen(false)}
      />
    </Stack>
  );
}
