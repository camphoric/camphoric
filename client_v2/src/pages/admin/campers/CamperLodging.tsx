/**
 * The camper editor's Lodging tab (SPEC §8.5), read-only: the unit the camper
 * is placed in and their stay, the unit's notes, and the other campers in that
 * unit with their stays — each opening that camper — plus a way to the lodging
 * screen with this camper selected. Placing campers happens there (§8.6).
 */

import { Anchor, Button, Group, Stack, Text } from '@mantine/core';
import { Field } from 'pages/admin/lodging/Field';
import { stayText } from 'pages/admin/lodging/timelineUtils';

import type { CamperLodgingSummary } from './camperLodgingSummary';

interface CamperLodgingProps {
  summary: CamperLodgingSummary;
  onSelectCamper: (camperId: number) => void;
  onOpenLodging: () => void;
}

export function CamperLodging({ summary, onSelectCamper, onOpenLodging }: CamperLodgingProps) {
  return (
    <Stack gap="sm">
      <Field label="Lodging">{summary.path ?? 'Unassigned'}</Field>
      {summary.path && (
        <>
          <Field label="Stay">{stayText(summary.stay)}</Field>
          {summary.notes && <Field label="Unit notes">{summary.notes}</Field>}
          <div>
            <Text size="xs" c="dimmed">
              Others in this unit
            </Text>
            {summary.others.length === 0 ? (
              <Text size="sm">No one else</Text>
            ) : (
              <Stack gap={2} role="list" aria-label="Others in this unit">
                {summary.others.map((other) => (
                  <Group key={other.id} gap="xs" wrap="nowrap" role="listitem">
                    <Anchor
                      component="button"
                      type="button"
                      size="sm"
                      onClick={() => onSelectCamper(other.id)}
                    >
                      {other.name}
                    </Anchor>
                    <Text size="sm" c="dimmed">
                      {stayText(other.stay)}
                    </Text>
                  </Group>
                ))}
              </Stack>
            )}
          </div>
        </>
      )}
      <Group>
        <Button size="compact-sm" variant="light" onClick={onOpenLodging}>
          Open in Lodging
        </Button>
      </Group>
    </Stack>
  );
}
