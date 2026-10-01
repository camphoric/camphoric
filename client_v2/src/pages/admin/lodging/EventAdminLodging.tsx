/**
 * Lodging (SPEC §8.6). Manages the event's lodging hierarchy (tree with
 * occupancy/capacity, node CRUD) and assigns campers to leaf units across the
 * event's days (assign/schedule/unassign). Persists assignment via PATCH camper
 * (`lodging`, `stay`); unassigning sets both to null.
 *
 * Two views (toggle): the "Hierarchy" (tree + node CRUD)
 * and the drag/resize "Timeline" (§8.6, DR-6), which lists the unassigned
 * campers and is where they're placed. Selecting a camper, or a lodging node by
 * its name, in either shows its details alongside without leaving the page;
 * the hierarchy's node details offer Edit. Each view keeps its own selections
 * (§15, DR-71). Notes show by an icon on the hierarchy; on the timeline, a mark
 * flags the nodes that have them (§15, DR-70). URL-addressable: the view
 * (`?lodgingView`), the selected camper and node (`?camperId` / `?lodgingId` on
 * the hierarchy, `?timelineCamperId` / `?timelineLodgingId` on the timeline),
 * and the lodging the timeline is narrowed to (`?lodgingFilter`,
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
import type { ApiLodging, AugmentedLodging, Scalar } from 'api-types';
import { confirmDelete } from 'components/ConfirmDelete';
import { FullScreenLoading } from 'components/Loading';
import { usePermissions } from 'hooks/permissions';
import { useRegistrationTypeLookup } from 'hooks/useAdminData';
import { useLodgingAssignment } from 'hooks/useLodgingAssignment';
import { useLodgingData } from 'hooks/useLodgingData';
import { useSearchTab } from 'hooks/useSearchTab';
import { type ReactNode, useMemo, useState } from 'react';
import { eventHooks, lodgingHooks, registrationHooks } from 'store/entities';
import { eventDays } from 'utils/dates';

import { camperLodgingDetails } from './camperLodgingDetails';
import { CamperLodgingInfo } from './CamperLodgingInfo';
import { LodgingDetailsPanel } from './LodgingDetailsPanel';
import { LodgingNodeForm } from './LodgingNodeForm';
import { LodgingTimeline } from './LodgingTimeline';
import { LodgingTree } from './LodgingTree';
import { lodgingFilterNodes, ownCapacity } from './timelineUtils';

const FROM = '/admin/organization/$organizationId/event/$eventId';

const VIEWS = ['hierarchy', 'timeline'] as const;

/** Each view keeps its own selections, so a panel opened in one doesn't show in the other. */
const SELECTION_PARAMS = {
  hierarchy: { camper: 'camperId', lodging: 'lodgingId' },
  timeline: { camper: 'timelineCamperId', lodging: 'timelineLodgingId' },
} as const;

interface NodeFormState {
  open: boolean;
  parentId?: Scalar | null;
  node?: ApiLodging;
}

/**
 * Keeps the details panels beside either view in view while the page scrolls;
 * panels taller than the window scroll on their own.
 */
const STICKY_TOP = 'calc(var(--app-shell-header-height, 0px) + var(--mantine-spacing-md))';
const stickyBesideView = {
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
  const [view, setView] = useSearchTab('lodgingView', VIEWS);
  // The hierarchy starts collapsed. Kept here, not in the tree, so it's as it
  // was left on coming back from the timeline.
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<number>>(new Set());
  const toggleExpanded = (lodgingId: number) =>
    setExpandedIds((ids) => {
      const next = new Set(ids);
      if (!next.delete(lodgingId)) next.add(lodgingId);
      return next;
    });

  const days = useMemo(() => (event ? eventDays(event.start, event.end) : []), [event]);
  const filterNodes = useMemo(() => lodgingFilterNodes(data?.tree), [data]);
  const shownLodgingIds = search.lodgingFilter?.split(',') ?? [];

  const params = SELECTION_PARAMS[view];
  const lodgingId = search[params.lodging];
  const selectedLodging = lodgingId ? data?.lodgingLookup[lodgingId] : undefined;
  const selectedCamper = data?.campers.find((c) => String(c.id) === search[params.camper]);
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
    setSearch({ [params.camper]: camperId ? String(camperId) : undefined });

  const selectLodging = (id?: number) =>
    setSearch({ [params.lodging]: id ? String(id) : undefined });

  // The form edits the capacity set on the node, not the tree's effective one (a
  // node set to 0 shows its units' sum, which saving would otherwise fix in place).
  const editNode = (node: AugmentedLodging) =>
    setNodeForm({ open: true, node: { ...node, capacity: ownCapacity(node) } });

  const setShownLodging = (ids: string[]) =>
    setSearch({ lodgingFilter: ids.length ? ids.join(',') : undefined });

  const openCamper = (camperId: number) =>
    void navigate({
      to: '/admin/organization/$organizationId/event/$eventId/campers',
      params: { organizationId, eventId },
      search: { camperId: String(camperId) },
    });

  const unassignById = (camperId: number) => {
    const c = data?.campers.find((x) => x.id === camperId);
    if (c) move.mutate({ camper: c, lodging: null, stay: null });
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

  const lodgingInfo: ReactNode = selectedLodging && (
    <LodgingDetailsPanel
      key={selectedLodging.id}
      node={selectedLodging}
      onClose={() => selectLodging(undefined)}
      onEdit={view === 'hierarchy' ? editNode : undefined}
    />
  );
  const sidePanels = (lodgingInfo || camperInfo) && (
    <Stack>
      {lodgingInfo}
      {camperInfo}
    </Stack>
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
          <Grid.Col span={{ base: 12, md: sidePanels ? 8 : 12 }}>
            <Card withBorder>
              {data.tree ? (
                <LodgingTree
                  node={data.tree}
                  depth={0}
                  onAddChild={(parentId) => setNodeForm({ open: true, parentId })}
                  onEdit={editNode}
                  onDelete={confirmDeleteNode}
                  onSelectCamper={selectCamper}
                  selectedLodgingId={selectedLodging?.id}
                  onSelectLodging={selectLodging}
                  expandedIds={expandedIds}
                  onToggleExpanded={toggleExpanded}
                />
              ) : (
                <Text c="dimmed">No lodging hierarchy yet. Add a root lodging to begin.</Text>
              )}
            </Card>
          </Grid.Col>
          {sidePanels && (
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Box style={stickyBesideView}>{sidePanels}</Box>
            </Grid.Col>
          )}
        </Grid>
      ) : (
        <Grid>
          <Grid.Col span={{ base: 12, lg: sidePanels ? 9 : 12 }}>
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
                selectedLodgingId={selectedLodging?.id}
                onSelectLodging={selectLodging}
              />
            </Card>
          </Grid.Col>
          {sidePanels && (
            <Grid.Col span={{ base: 12, lg: 3 }}>
              <Box style={stickyBesideView}>{sidePanels}</Box>
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
    </Stack>
  );
}
