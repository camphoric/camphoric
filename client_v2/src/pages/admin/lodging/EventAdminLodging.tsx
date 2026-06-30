/**
 * Lodging (SPEC §8.6). Manages the event's lodging hierarchy (tree with
 * occupancy/capacity, node CRUD) and assigns campers to leaf units across the
 * event's days (assign/schedule/unassign), with the unassigned campers listed
 * alongside. Persists assignment via PATCH camper (`lodging`, `stay`);
 * unassigning sets both to null.
 *
 * Two views (toggle): the form-based "Hierarchy" (tree + node CRUD + per-leaf
 * assign/unassign) and the drag/resize "Timeline" (§8.6, DR-6).
 */

import { Button, Card, Grid, Group, SegmentedControl, Stack, Text, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconPlus } from '@tabler/icons-react';
import { useNavigate, useParams } from '@tanstack/react-router';
import type { ApiCamper, ApiLodging, AugmentedLodging, Scalar } from 'api-types';
import { FullScreenLoading } from 'components/Loading';
import { useLodgingData } from 'hooks/useLodgingData';
import { useMemo, useState } from 'react';
import { camperHooks, eventHooks, lodgingHooks } from 'store/entities';
import { camperName } from 'utils/camper';
import { eventDays } from 'utils/dates';

import { AssignCamperModal } from './AssignCamperModal';
import { LodgingNodeForm } from './LodgingNodeForm';
import { LodgingTimeline } from './LodgingTimeline';
import { LodgingTree } from './LodgingTree';
import { UnassignedCampers } from './UnassignedCampers';

const FROM = '/admin/organization/$organizationId/event/$eventId';

interface NodeFormState {
  open: boolean;
  parentId?: Scalar | null;
  node?: ApiLodging;
}

export function EventAdminLodging() {
  const { organizationId, eventId } = useParams({ from: FROM });
  const navigate = useNavigate();
  const { data: event } = eventHooks.useById(eventId);
  const data = useLodgingData(eventId);
  const updateCamper = camperHooks.useUpdate();
  const deleteNode = lodgingHooks.useDelete();

  const [nodeForm, setNodeForm] = useState<NodeFormState>({ open: false });
  const [assigning, setAssigning] = useState<ApiCamper>();
  const [view, setView] = useState<'hierarchy' | 'timeline'>('hierarchy');

  const days = useMemo(() => (event ? eventDays(event.start, event.end) : []), [event]);
  const branches = useMemo(
    () => (data ? Object.values(data.lodgingLookup).filter((n) => !n.isLeaf) : []),
    [data],
  );

  const selectCamper = (camperId: number) =>
    void navigate({
      to: '/admin/organization/$organizationId/event/$eventId/campers',
      params: { organizationId, eventId },
      search: { camperId: String(camperId) },
    });

  const unassign = (c: ApiCamper) => updateCamper.mutate({ id: c.id, lodging: null, stay: null });

  const confirmDeleteNode = (node: AugmentedLodging) =>
    modals.openConfirmModal({
      title: 'Delete lodging',
      children: (
        <Text>
          Delete “{node.name}”{node.children.length > 0 ? ' and its children' : ''}? This cannot be
          undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteNode.mutate({ id: node.id }),
    });

  if (!event || !data) return <FullScreenLoading />;

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Title order={2}>Lodging</Title>
          <SegmentedControl
            value={view}
            onChange={(value) => setView(value as 'hierarchy' | 'timeline')}
            data={[
              { label: 'Hierarchy', value: 'hierarchy' },
              { label: 'Timeline', value: 'timeline' },
            ]}
          />
        </Group>
        {view === 'hierarchy' && !data.tree && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setNodeForm({ open: true, parentId: null })}
          >
            Add root lodging
          </Button>
        )}
      </Group>

      {view === 'hierarchy' ? (
        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Card withBorder>
              {data.tree ? (
                <LodgingTree
                  node={data.tree}
                  depth={0}
                  onAddChild={(parentId) => setNodeForm({ open: true, parentId })}
                  onEdit={(node) => setNodeForm({ open: true, node })}
                  onDelete={confirmDeleteNode}
                  onUnassign={unassign}
                  onSelectCamper={selectCamper}
                />
              ) : (
                <Text c="dimmed">No lodging hierarchy yet. Add a root lodging to begin.</Text>
              )}
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <UnassignedCampers
              campers={data.unassigned}
              lodgingLookup={data.lodgingLookup}
              onAssign={(c) => setAssigning(c)}
              onSelect={selectCamper}
            />
          </Grid.Col>
        </Grid>
      ) : (
        <Card withBorder>
          <LodgingTimeline
            days={days}
            leaves={data.leaves}
            branches={branches}
            unassigned={data.unassigned}
            defaultStayLength={event.default_stay_length}
            onAssign={(id, lodging, stay) => updateCamper.mutate({ id, lodging, stay })}
            onUnassign={(id) => updateCamper.mutate({ id, lodging: null, stay: null })}
            onSelectCamper={selectCamper}
          />
        </Card>
      )}

      <LodgingNodeForm
        key={nodeForm.node?.id ?? `new-${String(nodeForm.parentId)}`}
        eventId={eventId}
        parentId={nodeForm.parentId}
        node={nodeForm.node}
        opened={nodeForm.open}
        onClose={() => setNodeForm({ open: false })}
      />
      {assigning && (
        <AssignCamperModal
          key={assigning.id}
          event={event}
          camper={assigning}
          name={camperName(assigning)}
          leaves={data.leaves}
          opened
          onClose={() => setAssigning(undefined)}
        />
      )}
    </Stack>
  );
}
