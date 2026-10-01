/**
 * The lodging hierarchy as a tree (SPEC §8.6). Each node shows its occupancy vs.
 * capacity (and reserved count, visibility), with create-child / edit / delete
 * actions. Campers attach only to leaf nodes; a leaf lists its assigned campers
 * on one line, each name selecting the camper (whose details offer Unassign).
 * A node's name selects it, so its details show
 * alongside; an icon beside a node with notes opens them. Siblings are listed
 * by name, as on the timeline.
 */

import { ActionIcon, Anchor, Badge, Group, Stack, Text } from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import type { AugmentedLodging } from 'api-types';
import { CanEdit } from 'hooks/permissions';
import { Fragment } from 'react';
import { camperName } from 'utils/camper';

import { LodgingNameButton } from './LodgingNameButton';
import { NoteIndicator } from './NoteIndicator';
import { byName } from './timelineUtils';

interface LodgingTreeProps {
  node: AugmentedLodging;
  depth: number;
  onAddChild: (parentId: number) => void;
  onEdit: (node: AugmentedLodging) => void;
  onDelete: (node: AugmentedLodging) => void;
  onSelectCamper: (camperId: number) => void;
  selectedLodgingId?: number;
  onSelectLodging?: (lodgingId: number) => void;
}

export function LodgingTree({
  node,
  depth,
  onAddChild,
  onEdit,
  onDelete,
  onSelectCamper,
  selectedLodgingId,
  onSelectLodging,
}: LodgingTreeProps) {
  const overCapacity = node.capacity > 0 && node.count > node.capacity;

  return (
    <Stack gap={4}>
      <Group justify="space-between" pl={depth * 20} wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <LodgingNameButton
            node={node}
            fw={500}
            isSelected={node.id === selectedLodgingId}
            onSelect={onSelectLodging}
          />
          <Badge variant="light" color={overCapacity ? 'red' : 'blue'}>
            {node.count}/{node.capacity}
          </Badge>
          {node.reserved > 0 && (
            <Badge variant="light" color="orange">
              reserved {node.reserved}
            </Badge>
          )}
          {!node.visible && <Badge color="gray">hidden</Badge>}
          {node.availability === 'full' && (
            <Badge variant="light" color="red">
              marked full
            </Badge>
          )}
          {node.availability === 'open' && (
            <Badge variant="light" color="green">
              marked open
            </Badge>
          )}
          {node.notes.trim() && <NoteIndicator name={node.name} notes={node.notes.trim()} />}
        </Group>
        <CanEdit>
          <Group gap={2} wrap="nowrap">
            <ActionIcon variant="subtle" onClick={() => onAddChild(node.id)} aria-label="Add child">
              <IconPlus size={16} />
            </ActionIcon>
            <ActionIcon variant="subtle" onClick={() => onEdit(node)} aria-label="Edit">
              <IconPencil size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={() => onDelete(node)}
              aria-label="Delete"
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        </CanEdit>
      </Group>

      {node.isLeaf && node.campers.length > 0 && (
        <Text size="sm" pl={(depth + 1) * 20}>
          {node.campers.map((c, index) => (
            <Fragment key={c.id}>
              {index > 0 && ', '}
              <Anchor component="button" type="button" inherit onClick={() => onSelectCamper(c.id)}>
                {camperName(c)}
              </Anchor>
            </Fragment>
          ))}
        </Text>
      )}

      {[...node.children]
        .sort((a, b) => byName(a.name, b.name))
        .map((child) => (
          <LodgingTree
            key={child.id}
            node={child}
            depth={depth + 1}
            onAddChild={onAddChild}
            onEdit={onEdit}
            onDelete={onDelete}
            onSelectCamper={onSelectCamper}
            selectedLodgingId={selectedLodgingId}
            onSelectLodging={onSelectLodging}
          />
        ))}
    </Stack>
  );
}
