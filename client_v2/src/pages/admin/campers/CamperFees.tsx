/**
 * Review a camper's fees and custom charges (SPEC §8.5): the fee breakdown from
 * the camper's `server_pricing_results` (labels via `camper_pricing_logic`) and
 * its total, plus the custom charges (date, type, amount, notes) with add/remove.
 */

import { Button, Group, Stack, Table, Text, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconTrash } from '@tabler/icons-react';
import type { ApiCamper, ApiCustomCharge, ApiEvent } from 'api-types';
import { useState } from 'react';
import { customChargeHooks, customChargeTypeHooks } from 'store/entities';
import { formatMoney } from 'utils/money';

import { FeeBreakdown } from '../FeeBreakdown';
import { AddCustomChargeModal } from './AddCustomChargeModal';

export function CamperFees({ event, camper }: { event: ApiEvent; camper: ApiCamper }) {
  const { data: charges } = customChargeHooks.useList({ camper: camper.id });
  const { data: types } = customChargeTypeHooks.useList({ event: event.id });
  const del = customChargeHooks.useDelete();
  const [addOpen, setAddOpen] = useState(false);

  const typeLabel = (id: ApiCustomCharge['custom_charge_type']) =>
    types?.find((t) => String(t.id) === String(id))?.label ?? String(id);

  const confirmDelete = (cc: ApiCustomCharge) =>
    modals.openConfirmModal({
      title: 'Delete custom charge',
      children: (
        <Text>
          Delete {typeLabel(cc.custom_charge_type)} ({formatMoney(cc.amount)})?
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => del.mutate({ id: cc.id }),
    });

  return (
    <Stack>
      <Title order={4}>Fees &amp; custom charges</Title>
      <FeeBreakdown results={camper.server_pricing_results} logics={[event.camper_pricing_logic]} />
      <Group justify="space-between" maw={360}>
        <Text fw={600}>Total</Text>
        <Text fw={600}>{formatMoney(camper.server_pricing_results.total)}</Text>
      </Group>

      <Text fw={600}>Custom charges</Text>
      {charges && charges.length > 0 ? (
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
                  <Button
                    size="compact-sm"
                    variant="light"
                    color="red"
                    leftSection={<IconTrash size={14} />}
                    onClick={() => confirmDelete(cc)}
                  >
                    Delete
                  </Button>
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

      <Group>
        <Button variant="light" onClick={() => setAddOpen(true)}>
          Add custom charge
        </Button>
      </Group>

      <AddCustomChargeModal
        eventId={event.id}
        camper={camper}
        opened={addOpen}
        onClose={() => setAddOpen(false)}
      />
    </Stack>
  );
}
