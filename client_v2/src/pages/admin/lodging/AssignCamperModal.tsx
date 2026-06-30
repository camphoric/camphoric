/**
 * Assign a camper to a leaf lodging unit and set the days they're present
 * (SPEC §8.6). Persists via PATCH camper (`lodging`, `stay`). A new assignment
 * seeds its stay from the event's `default_stay_length` (the first N event days).
 */

import { Button, Checkbox, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ApiCamper, ApiEvent, AugmentedLodging } from 'api-types';
import { DateTime } from 'luxon';
import { useMemo, useState } from 'react';
import { camperHooks } from 'store/entities';
import { eventDays } from 'utils/dates';

const dayLabel = (iso: string) => {
  const dt = DateTime.fromISO(iso, { zone: 'utc' });
  return dt.isValid ? dt.toFormat('EEE MM/dd') : iso;
};

interface AssignCamperModalProps {
  event: ApiEvent;
  camper: ApiCamper;
  /** The name to show for the camper. */
  name: string;
  leaves: AugmentedLodging[];
  opened: boolean;
  onClose: () => void;
}

export function AssignCamperModal({
  event,
  camper,
  name,
  leaves,
  opened,
  onClose,
}: AssignCamperModalProps) {
  const update = camperHooks.useUpdate();
  const days = useMemo(() => eventDays(event.start, event.end), [event.start, event.end]);

  const [leafId, setLeafId] = useState<string>(
    camper.lodging != null ? String(camper.lodging) : (leaves[0] ? String(leaves[0].id) : ''),
  );
  const [stay, setStay] = useState<string[]>(
    camper.stay ?? days.slice(0, event.default_stay_length || days.length),
  );

  const save = () => {
    if (!leafId) return;
    update.mutate(
      { id: camper.id, lodging: Number(leafId), stay },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Camper assigned' });
          onClose();
        },
      },
    );
  };

  return (
    <Modal opened={opened} onClose={onClose} title={`Assign ${name}`}>
      <Stack>
        <Select
          label="Lodging unit"
          data={leaves.map((l) => ({ value: String(l.id), label: l.fullPath || l.name }))}
          value={leafId}
          onChange={(value) => setLeafId(value ?? '')}
          searchable
          allowDeselect={false}
        />
        <div>
          <Text size="sm" fw={500} mb={4}>
            Days present
          </Text>
          <Checkbox.Group value={stay} onChange={setStay}>
            <Stack gap={4}>
              {days.map((day) => (
                <Checkbox key={day} value={day} label={dayLabel(day)} />
              ))}
            </Stack>
          </Checkbox.Group>
        </div>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={update.isPending} disabled={!leafId}>
            Assign
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
