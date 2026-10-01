/**
 * A camper's lodging-relevant details, shown beside the hierarchy or timeline
 * while placing them (SPEC §8.6): where they are and for which days, the unit's
 * notes, what they asked for, sharing, lodging comments, registration type and notes, and their
 * answers — with a way to open the camper and a quick unassign. It sits beside
 * the timeline rather than over it, so bars stay draggable while it's open.
 */

import { Button, CloseButton, Divider, Group, Paper, Stack, Text, Title } from '@mantine/core';
import type { ReviewItem } from 'components/form';
import { CanEdit } from 'hooks/permissions';

import type { CamperLodgingDetails } from './camperLodgingDetails';
import { Field } from './Field';
import { areConsecutiveDays, dayLabel } from './timelineUtils';

interface CamperLodgingInfoProps {
  details: CamperLodgingDetails;
  onOpenCamper: (camperId: number) => void;
  onUnassign: (camperId: number) => void;
  onClose: () => void;
}

/** "3 days: Fri 10/16 – Sun 10/18", or the days listed when they aren't consecutive. */
function stayText(stay: string[]): string {
  if (stay.length === 0) return 'No days set';
  const count = `${stay.length} ${stay.length === 1 ? 'day' : 'days'}`;
  if (stay.length === 1) return `${count}: ${dayLabel(stay[0])}`;
  return areConsecutiveDays(stay)
    ? `${count}: ${dayLabel(stay[0])} – ${dayLabel(stay[stay.length - 1])}`
    : `${count}: ${stay.map((day) => dayLabel(day)).join(', ')}`;
}

/** Answers as label/value pairs, nested groups indented under their heading. */
function Answers({ items, depth = 0 }: { items: ReviewItem[]; depth?: number }) {
  return (
    <Stack gap={6} pl={depth ? 'sm' : 0}>
      {items.map((item, index) =>
        item.children ? (
          <Stack key={`${index}-${item.label}`} gap={4}>
            <Text size="xs" fw={600}>
              {item.label}
            </Text>
            <Answers items={item.children} depth={depth + 1} />
          </Stack>
        ) : (
          <Field key={`${index}-${item.label}`} label={item.label}>
            {item.text}
          </Field>
        ),
      )}
    </Stack>
  );
}

export function CamperLodgingInfo({
  details,
  onOpenCamper,
  onUnassign,
  onClose,
}: CamperLodgingInfoProps) {
  return (
    <Paper withBorder p="sm" aria-label={`Lodging details for ${details.name}`} role="region">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Title order={4}>{details.name}</Title>
          <CloseButton aria-label="Close camper details" onClick={onClose} />
        </Group>

        <Field label="Lodging">{details.assigned ?? 'Unassigned'}</Field>
        {details.assigned && <Field label="Stay">{stayText(details.stay)}</Field>}
        {details.unitNotes && <Field label="Unit notes">{details.unitNotes}</Field>}
        <Field label="Requested">{details.requested ?? 'None'}</Field>
        <Field label="Sharing">
          {details.shared ? `Yes, with ${details.sharedWith || '(unspecified)'}` : 'No'}
        </Field>
        <Field label="Lodging comments">{details.lodgingComments || 'None'}</Field>
        <Field label="Registration type">{details.registrationType ?? 'None'}</Field>
        {details.registrationNotes.length > 0 ? (
          <Answers items={details.registrationNotes} />
        ) : (
          <Field label="Registration notes">None</Field>
        )}

        <Group gap="xs">
          <Button size="compact-sm" variant="light" onClick={() => onOpenCamper(details.camperId)}>
            Open camper
          </Button>
          {details.assigned && (
            <CanEdit>
              <Button
                size="compact-sm"
                variant="subtle"
                color="red"
                onClick={() => onUnassign(details.camperId)}
              >
                Unassign
              </Button>
            </CanEdit>
          )}
        </Group>

        {details.attributes.length > 0 && (
          <>
            <Divider label="Camper details" labelPosition="left" />
            <Answers items={details.attributes} />
          </>
        )}
      </Stack>
    </Paper>
  );
}
