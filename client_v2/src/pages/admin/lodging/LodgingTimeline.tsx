/**
 * Lodging assignment timeline (SPEC §8.6, DR-6). A column per event day and a
 * row per leaf unit, the units grouped under a heading naming where they are
 * ("Camp 1 → Cabin"), with the sections and the units in them sorted by name.
 * Each assigned camper is a bar spanning their stay, offset by half a day
 * (campers arrive midday of their first day and depart midday of the day after
 * their last). Unassigned campers sit in a sidebar and are dragged
 * into a leaf×day cell; bars are dragged between cells (preserving duration) and
 * resized from the right edge to change the stay length; dragging a bar back to
 * the sidebar unassigns. Clicking a camper selects them (their details show
 * beside the timeline) rather than leaving the page, so a click that falls short
 * of a drag costs nothing. Clicking a unit's or section's name selects that
 * lodging node the same way (its details, notes included, show beside the
 * timeline); an icon marks the ones with notes. The view can be narrowed to any
 * set of lodging nodes.
 * The days share the width available evenly, down to a minimum below which the
 * timeline scrolls sideways; departure day, the last, is shown as just its
 * morning, since everyone has left by midday.
 *
 * Each unit's row is one drop target, and the day is read from where the
 * pointer is along it. A target per day cell (thousands, for a camp the size of
 * Lark) made dragging stutter: dnd-kit re-renders every droppable whenever the
 * target under the pointer changes, and measures each one as a drag starts.
 *
 * Presentational: the parent supplies the data and the assign/unassign
 * callbacks (so this renders in Storybook and against the live API alike).
 */

import {
  type Active,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  type Over,
  PointerSensor,
  pointerWithin,
  useDndMonitor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { Box, Group, MultiSelect, Paper, ScrollArea, Stack, Text } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import type { ApiCamper, AugmentedLodging } from 'api-types';
import { usePermissions } from 'hooks/permissions';
import {
  type KeyboardEvent,
  memo,
  type MutableRefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { camperName } from 'utils/camper';

import { LodgingNameButton, NotesMarker } from './LodgingNameButton';
import {
  dayLabel,
  leafSections,
  leavesUnder,
  lodgingPathLabel,
  stayableDays,
  stayFrom,
  staySpan,
  timelineDayUnits,
} from './timelineUtils';

/** The narrowest a day gets before the timeline scrolls sideways; the headers' small type fits. */
const MIN_DAY_WIDTH = 44;
const BAR_HEIGHT = 26;
const BAR_GAP = 4;
const ROW_PAD = 6;
const LABEL_WIDTH = 168;
const SELECTED_RING = '0 0 0 2px var(--mantine-color-orange-5)';

/** Enter or Space on a focused camper selects it, as a click does. */
const selectOnKey = (select: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    select();
  }
};

interface LodgingTimelineProps {
  days: string[];
  /** Every leaf unit; shown in sections sorted by name, each section's units by name. */
  leaves: AugmentedLodging[];
  /** The nodes the view can be narrowed to, in tree order. */
  filterNodes: AugmentedLodging[];
  /** The ids of the nodes shown; empty shows everything. */
  shownLodgingIds: string[];
  onShownLodgingChange: (ids: string[]) => void;
  unassigned: ApiCamper[];
  defaultStayLength: number;
  onAssign: (camperId: number, lodgingId: number, stay: string[]) => void;
  onUnassign: (camperId: number) => void;
  selectedCamperId?: number;
  onSelectCamper?: (camperId: number) => void;
  selectedLodgingId?: number;
  onSelectLodging?: (lodgingId: number) => void;
}

/** The pointer's latest viewport x during a drag. */
type PointerX = MutableRefObject<number>;

/** What a unit's row tells the drop handler: which unit, and the day at a viewport x. */
interface RowDropData {
  leafId: number;
  dayAt: (clientX: number) => number;
}

interface DragData {
  camper: ApiCamper;
  /** Whether this is a bar already placed in a leaf (vs. a sidebar camper). */
  placed: boolean;
  /** Current stay length for a placed bar (so a move preserves duration). */
  length: number;
}

export function LodgingTimeline({
  days,
  leaves,
  filterNodes,
  shownLodgingIds,
  onShownLodgingChange,
  unassigned,
  defaultStayLength,
  onAssign,
  onUnassign,
  selectedCamperId,
  onSelectCamper,
  selectedLodgingId,
  onSelectLodging,
}: LodgingTimelineProps) {
  const [active, setActive] = useState<DragData | null>(null);
  const { ref: widthRef, width } = useElementSize();
  const dayWidth = Math.max(
    MIN_DAY_WIDTH,
    Math.floor((width - LABEL_WIDTH) / timelineDayUnits(days.length)) || 0,
  );

  // Tracked in the capture phase so it's current before dnd-kit handles the same move.
  const pointerX = useRef(0);
  const trackPointer = useRef((e: PointerEvent) => (pointerX.current = e.clientX)).current;
  const stopTrackingPointer = () => window.removeEventListener('pointermove', trackPointer, true);

  // Stable callbacks for the rows, so a render here (as a drag starts or ends)
  // skips the hundreds of unchanged rows instead of re-rendering them all.
  const latest = useRef({ onAssign, onSelectCamper, onSelectLodging });
  useLayoutEffect(() => {
    latest.current = { onAssign, onSelectCamper, onSelectLodging };
  });
  const assignFromRow = useCallback<LodgingTimelineProps['onAssign']>(
    (camperId, lodgingId, stay) => latest.current.onAssign(camperId, lodgingId, stay),
    [],
  );
  const selectFromRow = useCallback(
    (camperId: number) => latest.current.onSelectCamper?.(camperId),
    [],
  );
  const selectLodgingFromRow = useCallback(
    (lodgingId: number) => latest.current.onSelectLodging?.(lodgingId),
    [],
  );
  const canSelectLodging = Boolean(onSelectLodging);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  // Only someone who may change lodging can drag (DR-51); others can still open campers.
  const { canEdit } = usePermissions();

  const shownNodes = filterNodes.filter((n) => shownLodgingIds.includes(String(n.id)));
  const sections = leafSections(leavesUnder(leaves, shownNodes));
  const nodeById = new Map(filterNodes.map((n) => [n.id, n]));

  const onDragStart = (e: DragStartEvent) => {
    if (e.activatorEvent instanceof PointerEvent) pointerX.current = e.activatorEvent.clientX;
    window.addEventListener('pointermove', trackPointer, true);
    setActive(dragData(e.active));
  };

  const onDragCancel = () => {
    stopTrackingPointer();
    setActive(null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    onDragCancel();
    const data = dragData(e.active);
    const over = e.over;
    if (!data || !over) return;

    if (over.id === 'unassigned') {
      if (data.placed) onUnassign(data.camper.id);
      return;
    }

    const row = over.data.current as RowDropData | undefined;
    if (!row) return;
    const length = data.placed ? data.length : defaultStayLength;
    // Dropped on the last (departure) day, the stay starts the day before.
    const stay = stayFrom(stayableDays(days), row.dayAt(pointerX.current), length);
    onAssign(data.camper.id, row.leafId, stay);
  };

  return (
    <DndContext
      sensors={canEdit ? sensors : []}
      collisionDetection={pointerWithin}
      modifiers={[restrictToWindowEdges]}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <Group align="flex-start" wrap="nowrap" gap="md">
        <UnassignedSidebar
          unassigned={unassigned}
          selectedCamperId={selectedCamperId}
          onSelectCamper={onSelectCamper}
        />

        <Stack ref={widthRef} gap="sm" style={{ flex: 1, minWidth: 0 }}>
          {filterNodes.length > 0 && (
            <MultiSelect
              label="Show lodging"
              placeholder={shownNodes.length ? undefined : 'All lodging'}
              data={filterNodes.map((n) => ({
                value: String(n.id),
                label: lodgingPathLabel(n.pathParts),
              }))}
              value={shownNodes.map((n) => String(n.id))}
              onChange={onShownLodgingChange}
              searchable
              clearable
              nothingFoundMessage="No lodging matches"
              maw={560}
            />
          )}

          <ScrollArea type="auto" offsetScrollbars="x">
            <Box style={{ minWidth: LABEL_WIDTH + timelineDayUnits(days.length) * dayWidth }}>
              {/* Header: day columns. */}
              <Group gap={0} wrap="nowrap" pl={LABEL_WIDTH}>
                {days.map((d, index) => {
                  const isDepartureDay = days.length > 1 && index === days.length - 1;
                  return (
                    <Text
                      key={d}
                      fz={10}
                      lh={1.3}
                      fw={500}
                      c={isDepartureDay ? 'dimmed' : undefined}
                      title={isDepartureDay ? 'Departure day: no one stays over' : undefined}
                      // Departure day's column is half as wide; its label runs from
                      // the column's start so it isn't squeezed.
                      ta={isDepartureDay ? 'left' : 'center'}
                      style={{
                        width: isDepartureDay ? dayWidth / 2 : dayWidth,
                        whiteSpace: 'pre-line',
                        overflow: 'visible',
                      }}
                    >
                      {dayLabel(d, 'EEE\nMM/dd')}
                    </Text>
                  );
                })}
              </Group>

              {sections.length === 0 ? (
                <Text c="dimmed" size="sm" p="md">
                  No lodging units to show.
                </Text>
              ) : (
                sections.map((section) => (
                  <Box key={section.leaves[0].id}>
                    <SectionHeading
                      heading={section.heading}
                      parent={nodeById.get(Number(section.parentId))}
                      isSelected={
                        section.parentId != null && Number(section.parentId) === selectedLodgingId
                      }
                      onSelectLodging={canSelectLodging ? selectLodgingFromRow : undefined}
                    />
                    {section.leaves.map((leaf) => (
                      <LeafRow
                        key={leaf.id}
                        leaf={leaf}
                        days={days}
                        dayWidth={dayWidth}
                        pointerX={pointerX}
                        // Only the row holding the selection needs to know it.
                        selectedCamperId={
                          leaf.campers.some((c) => c.id === selectedCamperId)
                            ? selectedCamperId
                            : undefined
                        }
                        onSelectCamper={selectFromRow}
                        onAssign={assignFromRow}
                        isSelected={leaf.id === selectedLodgingId}
                        onSelectLodging={canSelectLodging ? selectLodgingFromRow : undefined}
                      />
                    ))}
                  </Box>
                ))
              )}
            </Box>
          </ScrollArea>
        </Stack>
      </Group>

      <DragOverlay dropAnimation={null}>
        {active ? (
          <Box
            style={{
              height: BAR_HEIGHT,
              minWidth: MIN_DAY_WIDTH - 8,
              background: 'var(--mantine-primary-color-filled)',
              color: 'var(--mantine-color-white)',
              borderRadius: 4,
              padding: '0 8px',
              display: 'flex',
              alignItems: 'center',
              fontSize: 12,
            }}
          >
            {camperName(active.camper)}
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

const dragData = (active: Active): DragData | null =>
  (active.data.current as DragData | undefined) ?? null;

/** Names where the units below it are, e.g. "Camp 1 → Cabin"; the name selects that parent node. */
function SectionHeading({
  heading,
  parent,
  isSelected,
  onSelectLodging,
}: {
  heading: string;
  /** The node the units share (none for the root's "Top level"). */
  parent?: AugmentedLodging;
  isSelected: boolean;
  onSelectLodging?: (lodgingId: number) => void;
}) {
  return (
    <Box
      px="xs"
      py={4}
      mt="xs"
      style={{
        borderTop: '1px solid var(--mantine-color-default-border)',
        background: 'var(--mantine-color-default-hover)',
      }}
    >
      {/* Sticks to the left edge so the heading stays in view when scrolled sideways. */}
      <Group gap={4} wrap="nowrap" style={{ position: 'sticky', left: 8, display: 'inline-flex' }}>
        <Text size="sm" fw={700} role="heading" aria-level={3}>
          {parent ? (
            <LodgingNameButton
              node={parent}
              inherit
              span
              isSelected={isSelected}
              onSelect={onSelectLodging}
            >
              {heading}
            </LodgingNameButton>
          ) : (
            heading
          )}
        </Text>
        {parent?.notes.trim() && <NotesMarker />}
      </Group>
    </Box>
  );
}

function UnassignedSidebar({
  unassigned,
  selectedCamperId,
  onSelectCamper,
}: {
  unassigned: ApiCamper[];
  selectedCamperId?: number;
  onSelectCamper?: (camperId: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unassigned' });
  return (
    <Paper
      ref={setNodeRef}
      withBorder
      p="sm"
      w={220}
      style={{ outline: isOver ? '2px solid var(--mantine-primary-color-filled)' : undefined }}
    >
      <Stack gap="xs">
        <Text fw={600} size="sm">
          Unassigned ({unassigned.length})
        </Text>
        {unassigned.length === 0 ? (
          <Text c="dimmed" size="xs">
            All campers assigned. Drag a bar here to unassign.
          </Text>
        ) : (
          unassigned.map((c) => (
            <CamperChip
              key={c.id}
              camper={c}
              selected={c.id === selectedCamperId}
              onSelectCamper={onSelectCamper}
            />
          ))
        )}
      </Stack>
    </Paper>
  );
}

function CamperChip({
  camper,
  selected,
  onSelectCamper,
}: {
  camper: ApiCamper;
  selected: boolean;
  onSelectCamper?: (camperId: number) => void;
}) {
  const { canEdit } = usePermissions();
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `camper:${camper.id}`,
    data: { camper, placed: false, length: 1 } satisfies DragData,
  });
  return (
    <Paper
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      withBorder
      p={6}
      aria-current={selected || undefined}
      onClick={() => onSelectCamper?.(camper.id)}
      onKeyDown={selectOnKey(() => onSelectCamper?.(camper.id))}
      style={{
        cursor: canEdit ? 'grab' : 'pointer',
        opacity: isDragging ? 0.4 : 1,
        fontSize: 13,
        boxShadow: selected ? SELECTED_RING : undefined,
      }}
    >
      {camperName(camper)}
    </Paper>
  );
}

const LeafRow = memo(function LeafRow({
  leaf,
  days,
  dayWidth,
  pointerX,
  selectedCamperId,
  onSelectCamper,
  onAssign,
  isSelected,
  onSelectLodging,
}: {
  leaf: AugmentedLodging;
  days: string[];
  dayWidth: number;
  pointerX: PointerX;
  selectedCamperId?: number;
  onSelectCamper: (camperId: number) => void;
  onAssign: LodgingTimelineProps['onAssign'];
  isSelected: boolean;
  onSelectLodging?: (lodgingId: number) => void;
}) {
  const rowHeight = ROW_PAD * 2 + Math.max(1, leaf.campers.length) * (BAR_HEIGHT + BAR_GAP);
  const stayDayCount = stayableDays(days).length;

  return (
    <Group
      gap={0}
      wrap="nowrap"
      style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
    >
      <Box w={LABEL_WIDTH} px="xs" py={4} style={{ flexShrink: 0 }}>
        <Group gap={4} wrap="nowrap">
          <LodgingNameButton
            node={leaf}
            size="sm"
            fw={500}
            lineClamp={1}
            isSelected={isSelected}
            onSelect={onSelectLodging}
          />
          {leaf.notes.trim() && <NotesMarker />}
        </Group>
      </Box>
      <Box
        style={{
          position: 'relative',
          height: rowHeight,
          // Ends at midday of departure day, where the longest stay ends. A stay
          // recorded before the last day was kept out of stays can run past it;
          // it's left visible (not clipped) so it can be seen and fixed.
          width: timelineDayUnits(days.length) * dayWidth,
        }}
      >
        <RowDropZone
          leafId={leaf.id}
          dayCount={stayDayCount}
          dayWidth={dayWidth}
          pointerX={pointerX}
        />
        {leaf.campers.map((c, row) => (
          <CamperBar
            key={c.id}
            camper={c}
            row={row}
            days={days}
            stayDayCount={stayDayCount}
            dayWidth={dayWidth}
            selected={c.id === selectedCamperId}
            onSelectCamper={onSelectCamper}
            onResize={(camperId, stay) => onAssign(camperId, leaf.id, stay)}
          />
        ))}
      </Box>
    </Group>
  );
});

/**
 * The row's drop target, behind its bars: it draws the day grid lines and
 * highlights the day under the pointer while something is dragged over it.
 * A line marks the start of each day; the row ends partway through departure
 * day, so that day has no closing line.
 */
function RowDropZone({
  leafId,
  dayCount,
  dayWidth,
  pointerX,
}: {
  leafId: number;
  /** The days a stay can start on (the departure day isn't one). */
  dayCount: number;
  dayWidth: number;
  pointerX: PointerX;
}) {
  const id = `row:${leafId}`;
  const node = useRef<HTMLDivElement | null>(null);
  const dayAt = (clientX: number) => {
    const left = node.current?.getBoundingClientRect().left ?? 0;
    return Math.min(Math.max(0, Math.floor((clientX - left) / dayWidth)), dayCount - 1);
  };
  const { setNodeRef } = useDroppable({ id, data: { leafId, dayAt } satisfies RowDropData });

  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const followPointer = ({ over }: { over: Over | null }) =>
    setHoverDay(over?.id === id ? dayAt(pointerX.current) : null);
  const clearHover = () => setHoverDay(null);
  useDndMonitor({
    onDragOver: followPointer,
    onDragMove: followPointer,
    onDragEnd: clearHover,
    onDragCancel: clearHover,
  });

  return (
    <Box
      ref={(element: HTMLDivElement | null) => {
        node.current = element;
        setNodeRef(element);
      }}
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage:
          'linear-gradient(to right, var(--mantine-color-default-border) 1px, transparent 1px)',
        backgroundSize: `${dayWidth}px 100%`,
      }}
    >
      {hoverDay !== null && (
        <Box
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: hoverDay * dayWidth,
            width: dayWidth,
            background: 'var(--mantine-primary-color-light)',
          }}
        />
      )}
    </Box>
  );
}

function CamperBar({
  camper,
  row,
  days,
  stayDayCount,
  dayWidth,
  selected,
  onSelectCamper,
  onResize,
}: {
  camper: ApiCamper;
  row: number;
  days: string[];
  /** How many days a stay can cover: all but the departure day. */
  stayDayCount: number;
  dayWidth: number;
  selected: boolean;
  onSelectCamper?: (camperId: number) => void;
  onResize: (camperId: number, stay: string[]) => void;
}) {
  const { canEdit } = usePermissions();
  const span = staySpan(camper.stay, days);
  const baseLen = span ? span.end - span.start + 1 : 1;
  const resizing = useRef<{ startX: number; startLen: number } | null>(null);
  const [previewLen, setPreviewLen] = useState<number | null>(null);
  // A finished resize keeps its length on show until the camper's stay changes.
  // The saved (optimistic) stay reaches the bar a tick after the pointer is
  // released, so dropping the preview then flashed the old stay; a failed save
  // rolls the stay back, which also ends the preview.
  const [shownStay, setShownStay] = useState(camper.stay);
  if (camper.stay !== shownStay) {
    setShownStay(camper.stay);
    setPreviewLen(null);
  }
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `camper:${camper.id}`,
    data: { camper, placed: true, length: baseLen } satisfies DragData,
  });

  if (!span) return null;
  const len = previewLen ?? baseLen;

  const onResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizing.current = { startX: e.clientX, startLen: baseLen };
    const move = (ev: PointerEvent) => {
      if (!resizing.current) return;
      const deltaCols = Math.round((ev.clientX - resizing.current.startX) / dayWidth);
      const maxLen = Math.max(1, stayDayCount - span.start);
      setPreviewLen(Math.min(Math.max(1, resizing.current.startLen + deltaCols), maxLen));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const deltaCols = Math.round((ev.clientX - (resizing.current?.startX ?? 0)) / dayWidth);
      const maxLen = Math.max(1, stayDayCount - span.start);
      const finalLen = Math.min(
        Math.max(1, (resizing.current?.startLen ?? baseLen) + deltaCols),
        maxLen,
      );
      resizing.current = null;
      if (finalLen === baseLen) {
        setPreviewLen(null);
      } else {
        setPreviewLen(finalLen);
        onResize(camper.id, days.slice(span.start, span.start + finalLen));
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <Box
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-current={selected || undefined}
      onClick={() => onSelectCamper?.(camper.id)}
      onKeyDown={selectOnKey(() => onSelectCamper?.(camper.id))}
      style={{
        position: 'absolute',
        // Offset by half a day: campers arrive midday of their first day and
        // leave midday of the day after their last (so the bar spans mid-day to
        // mid-day, not full column edges).
        left: (span.start + 0.5) * dayWidth + 2,
        top: ROW_PAD + row * (BAR_HEIGHT + BAR_GAP),
        width: len * dayWidth - 4,
        height: BAR_HEIGHT,
        background: 'var(--mantine-primary-color-filled)',
        color: 'var(--mantine-color-white)',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        padding: '0 6px',
        fontSize: 12,
        cursor: canEdit ? 'grab' : 'pointer',
        opacity: isDragging ? 0.4 : 1,
        userSelect: 'none',
        boxShadow: selected ? SELECTED_RING : undefined,
      }}
    >
      <Text size="xs" lineClamp={1} style={{ flex: 1, color: 'inherit' }}>
        {camperName(camper)}
      </Text>
      {/* Right-edge resize handle (custom, per DR-6). */}
      {canEdit && (
        <Box
          onPointerDown={onResizePointerDown}
          // A resize ends in a click; keep it from selecting the camper.
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 8,
            cursor: 'ew-resize',
            borderTopRightRadius: 4,
            borderBottomRightRadius: 4,
            background: 'rgba(255,255,255,0.35)',
          }}
        />
      )}
    </Box>
  );
}
