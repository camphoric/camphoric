/**
 * Lodging (SPEC §8.6). Manages the event's lodging hierarchy (tree with
 * occupancy/capacity, node CRUD) and assigns campers to leaf units across the
 * event's days (assign/schedule/unassign), with the unassigned campers listed
 * alongside. Persists assignment via PATCH camper (`lodging`, `stay`);
 * unassigning sets both to null.
 *
 * Two views (toggle): the form-based "Hierarchy" (tree + node CRUD + per-leaf
 * assign/unassign) and the drag/resize "Timeline" (§8.6, DR-6). Selecting a
 * camper in either shows their lodging details alongside, without leaving the
 * page. URL-addressable: the view (`?lodgingView`), the selected camper
 * (`?camperId`), and the lodging the timeline is narrowed to (`?lodgingFilter`,
 * comma-separated node ids).
 */

import {
  Box,
  Button,
  Card,
  Grid,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { ApiCamper, ApiLodging, AugmentedLodging, Scalar } from 'api-types';
import { confirmDelete } from 'components/ConfirmDelete';
import { FullScreenLoading } from 'components/Loading';
import { usePermissions } from 'hooks/permissions';
import { useRegistrationTypeLookup } from 'hooks/useAdminData';
import { useLodgingAssignment } from 'hooks/useLodgingAssignment';
import { useLodgingData } from 'hooks/useLodgingData';
import { useSearchTab } from 'hooks/useSearchTab';
import { type ReactNode, useMemo, useState } from 'react';
import { eventHooks, lodgingHooks, registrationHooks } from 'store/entities';
import { camperName } from 'utils/camper';
import { eventDays } from 'utils/dates';

import { AssignCamperModal } from './AssignCamperModal';
import { camperLodgingDetails } from './camperLodgingDetails';
import { CamperLodgingInfo } from './CamperLodgingInfo';
import { LodgingNodeForm } from './LodgingNodeForm';
import { LodgingTimeline } from './LodgingTimeline';
import { LodgingTree } from './LodgingTree';
import { lodgingFilterNodes } from './timelineUtils';
import { UnassignedCampers } from './UnassignedCampers';

const FROM = '/admin/organization/$organizationId/event/$eventId';

const VIEWS = ['hierarchy', 'timeline'] as const;

interface NodeFormState {
  open: boolean;
  parentId?: Scalar | null;
  node?: ApiLodging;
}

/**
 * Keeps the camper's details beside the timeline in view while the page
 * scrolls; details taller than the window scroll on their own.
 */
const STICKY_TOP = 'calc(var(--app-shell-header-height, 0px) + var(--mantine-spacing-md))';
const stickyBesideTimeline = {
  position: 'sticky',
  top: STICKY_TOP,
  maxHeight: `calc(100vh - ${STICKY_TOP} - var(--mantine-spacing-md))`,
  overflowY: 'auto',
} as const;

export function EventAdminLodging() {
  const { organizationId, eventId } = useParams({ from: FROM });
  const search = useSearch({ from: FROM });
  const navigate = useNavigate();
  const { data: event } = eventHooks.useById(eventId);
  const data = useLodgingData(eventId);
  const { data: registrations } = registrationHooks.useList({ completed: 1, event: eventId });
  const registrationTypeLookup = useRegistrationTypeLookup(eventId);
  const move = useLodgingAssignment();
  const { canEdit } = usePermissions();
  const deleteNode = lodgingHooks.useDelete();

  const [nodeForm, setNodeForm] = useState<NodeFormState>({ open: false });
  const [assigning, setAssigning] = useState<ApiCamper>();
  const [view, setView] = useSearchTab('lodgingView', VIEWS);

  const days = useMemo(() => (event ? eventDays(event.start, event.end) : []), [event]);
  const filterNodes = useMemo(() => lodgingFilterNodes(data?.tree), [data]);
  const shownLodgingIds = search.lodgingFilter?.split(',') ?? [];

  const selectedCamper = data?.campers.find((c) => String(c.id) === search.camperId);
  const details = useMemo(() => {
    if (!event || !data || !selectedCamper) return undefined;
    return camperLodgingDetails({
      camper: selectedCamper,
      event,
      lodgingLookup: data.lodgingLookup,
      registration: registrations?.find((r) => r.id === Number(selectedCamper.registration)),
      registrationTypeLookup,
    });
  }, [event, data, selectedCamper, registrations, registrationTypeLookup]);

  const setSearch = (patch: Record<string, string | undefined>) =>
    void navigate({
      to: '/admin/organization/$organizationId/event/$eventId/lodging',
      params: { organizationId, eventId },
      search: (prev) => ({ ...prev, ...patch }),
    });

  const selectCamper = (camperId?: number) =>
    setSearch({ camperId: camperId ? String(camperId) : undefined });

  const setShownLodging = (ids: string[]) =>
    setSearch({ lodgingFilter: ids.length ? ids.join(',') : undefined });

  const openCamper = (camperId: number) =>
    void navigate({
      to: '/admin/organization/$organizationId/event/$eventId/campers',
      params: { organizationId, eventId },
      search: { camperId: String(camperId) },
    });

  const unassign = (c: ApiCamper) => move.mutate({ camper: c, lodging: null, stay: null });
  const unassignById = (camperId: number) => {
    const c = data?.campers.find((x) => x.id === camperId);
    if (c) unassign(c);
  };

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

  const camperInfo: ReactNode = details && (
    <CamperLodgingInfo
      key={details.camperId}
      details={details}
      onOpenCamper={openCamper}
      onUnassign={unassignById}
      onClose={() => selectCamper(undefined)}
    />
  );

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
            <Stack>
              {camperInfo}
              <UnassignedCampers
                campers={data.unassigned}
                lodgingLookup={data.lodgingLookup}
                onAssign={(c) => setAssigning(c)}
                onSelect={selectCamper}
              />
            </Stack>
          </Grid.Col>
        </Grid>
      ) : (
        <Grid>
          <Grid.Col span={{ base: 12, lg: camperInfo ? 9 : 12 }}>
            <Card withBorder>
              <LodgingTimeline
                days={days}
                leaves={data.leaves}
                filterNodes={filterNodes}
                shownLodgingIds={shownLodgingIds}
                onShownLodgingChange={setShownLodging}
                unassigned={data.unassigned}
                defaultStayLength={event.default_stay_length}
                onAssign={(id, lodging, stay) => {
                  const c = data.campers.find((x) => x.id === id);
                  if (c) move.mutate({ camper: c, lodging, stay });
                }}
                onUnassign={unassignById}
                selectedCamperId={selectedCamper?.id}
                onSelectCamper={selectCamper}
              />
            </Card>
          </Grid.Col>
          {camperInfo && (
            <Grid.Col span={{ base: 12, lg: 3 }}>
              <Box style={stickyBesideTimeline}>{camperInfo}</Box>
            </Grid.Col>
          )}
        </Grid>
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
