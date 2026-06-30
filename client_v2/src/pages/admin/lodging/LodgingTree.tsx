/**
 * The lodging hierarchy as a tree (SPEC §8.6). Each node shows its occupancy vs.
 * capacity (and reserved count, visibility), with create-child / edit / delete
 * actions. Campers attach only to leaf nodes; a leaf lists its assigned campers,
 * each with a quick unassign.
 */

import { ActionIcon, Anchor, Badge, Button, Group, Stack, Text } from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import type { ApiCamper, AugmentedLodging } from 'api-types';
import { camperName } from 'utils/camper';

interface LodgingTreeProps {
  node: AugmentedLodging;
  depth: number;
  onAddChild: (parentId: number) => void;
  onEdit: (node: AugmentedLodging) => void;
  onDelete: (node: AugmentedLodging) => void;
  onUnassign: (camper: ApiCamper) => void;
  onSelectCamper: (camperId: number) => void;
}

export function LodgingTree({
  node,
  depth,
  onAddChild,
  onEdit,
  onDelete,
  onUnassign,
  onSelectCamper,
}: LodgingTreeProps) {
  const overCapacity = node.capacity > 0 && node.count > node.capacity;

  return (
    <Stack gap={4}>
      <Group justify="space-between" pl={depth * 20} wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <Text fw={500}>{node.name}</Text>
          <Badge variant="light" color={overCapacity ? 'red' : 'blue'}>
            {node.count}/{node.capacity}
          </Badge>
          {node.reserved > 0 && (
            <Badge variant="light" color="orange">
              reserved {node.reserved}
            </Badge>
          )}
          {!node.visible && <Badge color="gray">hidden</Badge>}
        </Group>
        <Group gap={2} wrap="nowrap">
          <ActionIcon variant="subtle" onClick={() => onAddChild(node.id)} aria-label="Add child">
            <IconPlus size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" onClick={() => onEdit(node)} aria-label="Edit">
            <IconPencil size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="red" onClick={() => onDelete(node)} aria-label="Delete">
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {node.isLeaf && node.campers.length > 0 && (
        <Stack gap={2} pl={(depth + 1) * 20}>
          {node.campers.map((c) => (
            <Group key={c.id} justify="space-between" maw={420} wrap="nowrap">
              <Anchor component="button" type="button" size="sm" onClick={() => onSelectCamper(c.id)}>
                {camperName(c)}
              </Anchor>
              <Button
                size="compact-xs"
                variant="subtle"
                color="red"
                onClick={() => onUnassign(c)}
              >
                Unassign
              </Button>
            </Group>
          ))}
        </Stack>
      )}

      {node.children.map((child) => (
        <LodgingTree
          key={child.id}
          node={child}
          depth={depth + 1}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
          onUnassign={onUnassign}
          onSelectCamper={onSelectCamper}
        />
      ))}
    </Stack>
  );
}
