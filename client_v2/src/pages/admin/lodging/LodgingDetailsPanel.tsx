/**
 * A lodging node's details, shown beside the hierarchy or the timeline when the
 * node is selected (SPEC §8.6): where it is, how full it is, and every value
 * its form sets — with, where the view offers it, a way to edit the node.
 */

import { Button, CloseButton, Group, Paper, Stack, Text, Title } from '@mantine/core';
import type { AugmentedLodging, LodgingAvailability } from 'api-types';
import { CanEdit } from 'hooks/permissions';

import { Field } from './Field';
import { lodgingPathLabel, ownCapacity } from './timelineUtils';

/** As the node's form names them. */
const AVAILABILITY: Record<LodgingAvailability, string> = {
  auto: 'By capacity',
  full: 'Always full',
  open: 'Always open',
};

interface LodgingDetailsPanelProps {
  node: AugmentedLodging;
  onClose: () => void;
  /** Opens the node's form; without it there's no Edit action. */
  onEdit?: (node: AugmentedLodging) => void;
}

export function LodgingDetailsPanel({ node, onClose, onEdit }: LodgingDetailsPanelProps) {
  const isOver = node.capacity > 0 && node.count > node.capacity;
  const isSummed = !node.isLeaf && ownCapacity(node) === 0;

  return (
    <Paper withBorder p="sm" aria-label={`Details for ${node.name}`} role="region">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Title order={4}>{node.name}</Title>
          <CloseButton aria-label="Close lodging details" onClick={onClose} />
        </Group>
        <Field label="Where">
          {node.pathParts.length ? lodgingPathLabel(node.pathParts) : 'Top level'}
        </Field>
        <Field label="Occupancy">
          <Text span inherit c={isOver ? 'red' : undefined}>
            {node.count} of {node.capacity}
            {isOver && ' (over capacity)'}
          </Text>
        </Field>
        <Field label="Capacity">
          {isSummed ? `${node.capacity} (the sum of the units under it)` : node.capacity}
        </Field>
        <Field label="Reserved">{node.reserved}</Field>
        <Field label="Sharing multiplier">{node.sharing_multiplier}</Field>
        {!node.isLeaf && <Field label="Units under it">{node.children.length}</Field>}
        <Field label="Children title">{node.children_title || 'None'}</Field>
        <Field label="Visible">{node.visible ? 'Yes' : 'No'}</Field>
        <Field label="On the registration form">{AVAILABILITY[node.availability]}</Field>
        <Field label="Notes">{node.notes.trim() || 'None'}</Field>

        {onEdit && (
          <CanEdit>
            <Group gap="xs">
              <Button size="compact-sm" variant="light" onClick={() => onEdit(node)}>
                Edit
              </Button>
            </Group>
          </CanEdit>
        )}
      </Stack>
    </Paper>
  );
}
