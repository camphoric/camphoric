/**
 * The lodging hierarchy as a tree (SPEC §8.6). Each node shows its occupancy vs.
 * capacity (and reserved count, visibility), with create-child / edit / delete
 * actions. Campers attach only to leaf nodes; a leaf lists its assigned campers
 * on one line, each name selecting the camper (whose details offer Unassign).
 * A node's name selects it, so its details show alongside; an icon beside a
 * node with notes opens them. Siblings are listed by name, as on the timeline.
 * Every node with nodes under it, but the root, can be collapsed to hide them;
 * they start collapsed, so the tree opens at the root's children.
 */

import { ActionIcon, Anchor, Badge, Box, Group, Stack, Text } from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
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
  /** The nodes expanded to show what's under them; the rest below the root are collapsed. */
  expandedIds: ReadonlySet<number>;
  onToggleExpanded: (lodgingId: number) => void;
}

/**
 * Below the root, each row starts with a slot for the collapse toggle, empty
 * for a unit, so names line up; a unit's campers line up with its name too.
 */
const TOGGLE_SLOT = 24;

export function LodgingTree({
  node,
  depth,
  onAddChild,
  onEdit,
  onDelete,
  onSelectCamper,
  selectedLodgingId,
  onSelectLodging,
  expandedIds,
  onToggleExpanded,
}: LodgingTreeProps) {
  const overCapacity = node.capacity > 0 && node.count > node.capacity;
  const isRoot = depth === 0;
  const hasCampers = node.isLeaf && node.campers.length > 0;
  const canCollapse = !isRoot && node.children.length > 0;
  const isCollapsed = canCollapse && !expandedIds.has(node.id);

  return (
    <Stack gap={4}>
      <Group justify="space-between" pl={depth * 20} wrap="nowrap">
        <Group gap={4} wrap="nowrap">
          {!isRoot && (
            <Box w={TOGGLE_SLOT} style={{ flexShrink: 0 }}>
              {canCollapse && (
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${node.name}`}
                  aria-expanded={!isCollapsed}
                  onClick={() => onToggleExpanded(node.id)}
                >
                  {isCollapsed ? <IconChevronRight size={16} /> : <IconChevronDown size={16} />}
                </ActionIcon>
              )}
            </Box>
          )}
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

      {hasCampers && (
        <Text size="sm" pl={depth * 20} ml={isRoot ? 0 : TOGGLE_SLOT + 4}>
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

      {!isCollapsed &&
        [...node.children]
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
              expandedIds={expandedIds}
              onToggleExpanded={onToggleExpanded}
            />
          ))}
    </Stack>
  );
}
