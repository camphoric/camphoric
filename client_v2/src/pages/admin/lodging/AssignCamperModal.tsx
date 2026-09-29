/**
 * Assign a camper to a leaf lodging unit and set the days they're present
 * (SPEC §8.6). Persists via PATCH camper (`lodging`, `stay`). A new assignment
 * seeds its stay from the event's `default_stay_length` (the first N event days).
 * The last day is departure day, which no one stays over, so it isn't offered.
 */

import { Button, Checkbox, Group, Modal, Select, Stack, Text } from '@mantine/core';
import type { ApiCamper, ApiEvent, AugmentedLodging } from 'api-types';
import { useMemo, useState } from 'react';
import { eventDays } from 'utils/dates';

import { dayLabel, stayableDays } from './timelineUtils';

interface AssignCamperModalProps {
  event: ApiEvent;
  camper: ApiCamper;
  /** The name to show for the camper. */
  name: string;
  leaves: AugmentedLodging[];
  opened: boolean;
  /** Persist the assignment (the caller owns the optimistic mutation + toast). */
  onAssign: (lodging: number, stay: string[]) => void;
  onClose: () => void;
}

export function AssignCamperModal({
  event,
  camper,
  name,
  leaves,
  opened,
  onAssign,
  onClose,
}: AssignCamperModalProps) {
  const days = useMemo(() => eventDays(event.start, event.end), [event.start, event.end]);

  // A camper may sit on a branch (the node they requested), which isn't a choice here.
  const [leafId, setLeafId] = useState<string>(() => {
    const current = leaves.find((l) => l.id === camper.lodging) ?? leaves[0];
    return current ? String(current.id) : '';
  });
  const stayDays = stayableDays(days);
  const departureDay = days.length > 1 ? days[days.length - 1] : undefined;
  // A stay saved before the departure day was kept out of stays loses it here.
  const [stay, setStay] = useState<string[]>(() =>
    (camper.stay ?? stayDays.slice(0, event.default_stay_length || stayDays.length)).filter((day) =>
      stayDays.includes(day),
    ),
  );

  const save = () => {
    if (!leafId) return;
    // Persist optimistically via the caller; close right away (the toast shows progress).
    onAssign(Number(leafId), stay);
    onClose();
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
              {stayDays.map((day) => (
                <Checkbox key={day} value={day} label={dayLabel(day)} />
              ))}
            </Stack>
          </Checkbox.Group>
          {departureDay && (
            <Text size="xs" c="dimmed" mt={4}>
              {dayLabel(departureDay)} is departure day; no one stays over.
            </Text>
          )}
        </div>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!leafId}>
            Assign
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
