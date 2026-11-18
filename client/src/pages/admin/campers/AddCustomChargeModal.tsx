/**
 * Add a custom charge to a camper (SPEC §8.5), or to a registration itself
 * (§8.4; §15, DR-168): choose a custom-charge type, amount (negative for a
 * discount or credit), and notes; persists via POST. Adding a charge changes the
 * camper's (and registration's) derived totals (multi-key invalidation).
 */

import { Button, Group, Modal, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ApiCamper, Scalar } from 'api-types';
import { useState } from 'react';
import { customChargeHooks, customChargeTypeHooks } from 'store/entities';

interface AddCustomChargeModalProps {
  eventId: Scalar;
  registrationId: Scalar;
  /** The camper charged; leave out for a charge of the registration's own. */
  camper?: ApiCamper;
  opened: boolean;
  onClose: () => void;
}

export function AddCustomChargeModal({
  eventId,
  registrationId,
  camper,
  opened,
  onClose,
}: AddCustomChargeModalProps) {
  const create = customChargeHooks.useCreate();
  const { data: types } = customChargeTypeHooks.useList({ event: eventId });

  const [type, setType] = useState<string>('');
  const [amount, setAmount] = useState<number | string>(0);
  const [notes, setNotes] = useState('');

  const effectiveType = type || (types?.[0] ? String(types[0].id) : '');

  const save = () => {
    if (!effectiveType) return;
    create.mutate(
      {
        registration: registrationId,
        camper: camper?.id ?? null,
        // Set only by cancelling a camper (DR-168).
        cancelled_camper: null,
        custom_charge_type: Number(effectiveType),
        amount: Number(amount) || 0,
        notes,
      },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Custom charge added' });
          onClose();
        },
      },
    );
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Add custom charge">
      <Stack>
        {types && types.length === 0 ? (
          <Text c="dimmed" size="sm">
            No custom-charge types are defined for this event.
          </Text>
        ) : (
          <>
            <Select
              label="Type"
              data={(types ?? []).map((t) => ({ value: String(t.id), label: t.label }))}
              value={effectiveType}
              onChange={(value) => setType(value ?? '')}
              allowDeselect={false}
            />
            <NumberInput
              label="Amount"
              description="A negative amount is a discount or credit."
              prefix="$"
              value={amount}
              onChange={setAmount}
            />
            <TextInput
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={save} loading={create.isPending}>
                Add charge
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
