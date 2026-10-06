/**
 * Assign a camper to a leaf lodging unit and set the days they're present
 * (SPEC §8.6). Persists via PATCH camper (`lodging`, `stay`). A new assignment
 * seeds its stay from the event's `default_stay_length` (the first N event days).
 * The last day is departure day, which no one stays over, so it isn't offered.
 */

import { Button, Group, Modal, Select, Stack } from '@mantine/core';
import type { ApiCamper, ApiEvent, AugmentedLodging } from 'api-types';
import { useMemo, useState } from 'react';
import { eventDays } from 'utils/dates';

import { StayCheckboxes } from './StayCheckboxes';
import { stayableDays, stayWithinStayableDays } from './timelineUtils';

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
  const [stay, setStay] = useState<string[]>(() => {
    const stayDays = stayableDays(days);
    return stayWithinStayableDays(
      camper.stay ?? stayDays.slice(0, event.default_stay_length || stayDays.length),
      days,
    );
  });

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
        <StayCheckboxes days={days} value={stay} onChange={setStay} />
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
