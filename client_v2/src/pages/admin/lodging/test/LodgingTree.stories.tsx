/**
 * Stories for the LodgingTree (SPEC §8.6): the hierarchy with occupancy, node
 * actions, and each leaf's campers on one line, siblings listed by name. Cabin A, Tent 1,
 * and Cabins carry notes, which an icon beside the node opens. A node's name
 * selects it, showing its details alongside with an Edit action. A Reporter
 * sees no node actions or Edit (DR-51). Run `npm run storybook`.
 */

import { Card, Grid, Text } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import type { AugmentedLodging } from 'api-types';
import { PermissionsProvider } from 'hooks/permissions';
import { useState } from 'react';
import { listLodgingTree } from 'store/augmented';

import { LodgingDetailsPanel } from '../LodgingDetailsPanel';
import { LodgingTree } from '../LodgingTree';
import { CAMPERS, treeWith } from './lodgingFixtures';

export default { title: 'Lodging Tree' } satisfies Meta;

const noop = () => undefined;
const TREE = treeWith(CAMPERS);

export const Hierarchy: StoryFn = () => {
  const [selectedId, setSelectedId] = useState<number>();
  const [editing, setEditing] = useState<AugmentedLodging>();
  const selected = listLodgingTree(TREE).find((n) => n.id === selectedId);

  return (
    <Grid p="md">
      <Grid.Col span={selected ? 8 : 12}>
        <Text size="sm" mb="xs" data-testid="editing">
          Editing: {editing?.name ?? 'nothing'}
        </Text>
        <Card withBorder>
          <LodgingTree
            node={TREE}
            depth={0}
            onAddChild={noop}
            onEdit={setEditing}
            onDelete={noop}
            onSelectCamper={noop}
            selectedLodgingId={selectedId}
            onSelectLodging={setSelectedId}
          />
        </Card>
      </Grid.Col>
      {selected && (
        <Grid.Col span={4}>
          <LodgingDetailsPanel
            node={selected}
            onClose={() => setSelectedId(undefined)}
            onEdit={setEditing}
          />
        </Grid.Col>
      )}
    </Grid>
  );
};

export const AsReporter: StoryFn = () => (
  <PermissionsProvider userRole="reporter">
    <Hierarchy />
  </PermissionsProvider>
);
