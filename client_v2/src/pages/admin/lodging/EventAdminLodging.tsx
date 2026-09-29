/**
 * Lodging (SPEC §8.6). Manages the event's lodging hierarchy (tree with
 * occupancy/capacity, node CRUD) and assigns campers to leaf units across the
 * event's days (assign/schedule/unassign), with the unassigned campers listed
 * alongside. Persists assignment via PATCH camper (`lodging`, `stay`);
 * unassigning sets both to null.
 *
 * Two views (toggle): the form-based "Hierarchy" (tree + node CRUD + per-leaf
 * assign/unassign) and the drag/resize "Timeline" (§8.6, DR-6). The view is
 * URL-addressable via `?lodgingView`.
 */

import { Button, Card, Grid, Group, SegmentedControl, Stack, Text, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useNavigate, useParams } from '@tanstack/react-router';
import type { ApiCamper, ApiLodging, AugmentedLodging, Scalar } from 'api-types';
import { confirmDelete } from 'components/ConfirmDelete';
import { FullScreenLoading } from 'components/Loading';
import { usePermissions } from 'hooks/permissions';
import { useLodgingAssignment } from 'hooks/useLodgingAssignment';
import { useLodgingData } from 'hooks/useLodgingData';
import { useSearchTab } from 'hooks/useSearchTab';
import { useMemo, useState } from 'react';
import { eventHooks, lodgingHooks } from 'store/entities';
import { camperName } from 'utils/camper';
import { eventDays } from 'utils/dates';

import { AssignCamperModal } from './AssignCamperModal';
import { LodgingNodeForm } from './LodgingNodeForm';
import { LodgingTimeline } from './LodgingTimeline';
import { LodgingTree } from './LodgingTree';
import { UnassignedCampers } from './UnassignedCampers';

const FROM = '/admin/organization/$organizationId/event/$eventId';

const VIEWS = ['hierarchy', 'timeline'] as const;

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
  const move = useLodgingAssignment();
  const { canEdit } = usePermissions();
  const deleteNode = lodgingHooks.useDelete();

  const [nodeForm, setNodeForm] = useState<NodeFormState>({ open: false });
  const [assigning, setAssigning] = useState<ApiCamper>();
  const [view, setView] = useSearchTab('lodgingView', VIEWS);

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

  const unassign = (c: ApiCamper) => move.mutate({ camper: c, lodging: null, stay: null });

  const confirmDeleteNode = (node: AugmentedLodging) =>
    confirmDelete({
      path: 'lodgings',
      id: node.id,
      title: 'Delete lodging',
      message: (
        <>
          Delete “{node.name}”{node.children.length > 0 ? ' and everything under it' : ''}?
        </>
      ),
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
            onChange={setView}
            data={[
              { label: 'Hierarchy', value: 'hierarchy' },
              { label: 'Timeline', value: 'timeline' },
            ]}
          />
        </Group>
        {view === 'hierarchy' && !data.tree && canEdit && (
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
            onAssign={(id, lodging, stay) => {
              const c = data.campers.find((x) => x.id === id);
              if (c) move.mutate({ camper: c, lodging, stay });
            }}
            onUnassign={(id) => {
              const c = data.campers.find((x) => x.id === id);
              if (c) move.mutate({ camper: c, lodging: null, stay: null });
            }}
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
          onAssign={(lodging, stay) => move.mutate({ camper: assigning, lodging, stay })}
          onClose={() => setAssigning(undefined)}
        />
      )}
    </Stack>
  );
}
