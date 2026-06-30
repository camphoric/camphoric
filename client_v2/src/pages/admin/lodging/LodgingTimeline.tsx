/**
 * Lodging assignment timeline (SPEC §8.6, DR-6). A column per event day and a
 * row per leaf unit; each assigned camper is a bar spanning the days of their
 * stay. Unassigned campers sit in a sidebar and are dragged into a leaf×day
 * cell; bars are dragged between cells (preserving duration) and resized from
 * the right edge to change the stay length; dragging a bar back to the sidebar
 * unassigns. The view can be narrowed to a branch of the hierarchy.
 *
 * Presentational: the parent supplies the data and the assign/unassign
 * callbacks (so this renders in Ladle and against the live API alike).
 */

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { Box, Group, Paper, ScrollArea, Select, Stack, Text } from '@mantine/core';
import type { ApiCamper, AugmentedLodging } from 'api-types';
import { DateTime } from 'luxon';
import { useRef, useState } from 'react';
import { camperName } from 'utils/camper';

import { stayFrom, staySpan } from './timelineUtils';

const DAY_WIDTH = 104;
const BAR_HEIGHT = 26;
const BAR_GAP = 4;
const ROW_PAD = 6;
const LABEL_WIDTH = 168;

const dayLabel = (iso: string) => {
  const dt = DateTime.fromISO(iso, { zone: 'utc' });
  return dt.isValid ? dt.toFormat('EEE\nMM/dd') : iso;
};

interface LodgingTimelineProps {
  days: string[];
  leaves: AugmentedLodging[];
  branches: AugmentedLodging[];
  unassigned: ApiCamper[];
  defaultStayLength: number;
  onAssign: (camperId: number, lodgingId: number, stay: string[]) => void;
  onUnassign: (camperId: number) => void;
  onSelectCamper?: (camperId: number) => void;
}

interface DragData {
  camper: ApiCamper;
  /** Current stay length for a placed bar (so a move preserves duration). */
  length: number;
}

export function LodgingTimeline({
  days,
  leaves,
  branches,
  unassigned,
  defaultStayLength,
  onAssign,
  onUnassign,
  onSelectCamper,
}: LodgingTimelineProps) {
  const [branchId, setBranchId] = useState<string | null>(null);
  const [active, setActive] = useState<DragData | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const branch = branches.find((b) => String(b.id) === branchId);
  const visibleLeaves =
    branch == null
      ? leaves
      : leaves.filter((l) => l.fullPath === branch.fullPath || l.fullPath.startsWith(`${branch.fullPath}→`));

  const onDragStart = (e: DragStartEvent) => setActive((e.active.data.current as DragData) ?? null);

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const data = e.active.data.current as DragData | undefined;
    const over = e.over;
    if (!data || !over) return;

    if (over.id === 'unassigned') {
      if (data.camper.lodging != null) onUnassign(data.camper.id);
      return;
    }

    const overId = String(over.id);
    if (!overId.startsWith('cell:')) return;
    const [, leafId, dayIndex] = overId.split(':');
    const length = data.camper.lodging != null ? data.length : defaultStayLength;
    onAssign(data.camper.id, Number(leafId), stayFrom(days, Number(dayIndex), length));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      modifiers={[restrictToWindowEdges]}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <Group align="flex-start" wrap="nowrap" gap="md">
        <UnassignedSidebar unassigned={unassigned} onSelectCamper={onSelectCamper} />

        <Stack gap="sm" style={{ flex: 1, minWidth: 0 }}>
          {branches.length > 0 && (
            <Select
              label="Show branch"
              placeholder="Whole hierarchy"
              data={branches.map((b) => ({ value: String(b.id), label: b.fullPath || b.name }))}
              value={branchId}
              onChange={setBranchId}
              clearable
              maw={320}
            />
          )}

          <ScrollArea type="auto">
            <Box style={{ minWidth: LABEL_WIDTH + days.length * DAY_WIDTH }}>
              {/* Header: day columns. */}
              <Group gap={0} wrap="nowrap" pl={LABEL_WIDTH}>
                {days.map((d) => (
                  <Text
                    key={d}
                    size="xs"
                    fw={500}
                    ta="center"
                    style={{ width: DAY_WIDTH, whiteSpace: 'pre-line' }}
                  >
                    {dayLabel(d)}
                  </Text>
                ))}
              </Group>

              {visibleLeaves.length === 0 ? (
                <Text c="dimmed" size="sm" p="md">
                  No lodging units to show.
                </Text>
              ) : (
                visibleLeaves.map((leaf) => (
                  <LeafRow
                    key={leaf.id}
                    leaf={leaf}
                    days={days}
                    onSelectCamper={onSelectCamper}
                    onResize={(camperId, stay) => onAssign(camperId, leaf.id, stay)}
                  />
                ))
              )}
            </Box>
          </ScrollArea>
        </Stack>
      </Group>

      <DragOverlay>
        {active ? (
          <Box
            style={{
              height: BAR_HEIGHT,
              minWidth: DAY_WIDTH - 8,
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

function UnassignedSidebar({
  unassigned,
  onSelectCamper,
}: {
  unassigned: ApiCamper[];
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
            <CamperChip key={c.id} camper={c} onSelectCamper={onSelectCamper} />
          ))
        )}
      </Stack>
    </Paper>
  );
}

function CamperChip({
  camper,
  onSelectCamper,
}: {
  camper: ApiCamper;
  onSelectCamper?: (camperId: number) => void;
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `camper:${camper.id}`,
    data: { camper, length: 1 } satisfies DragData,
  });
  return (
    <Paper
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      withBorder
      p={6}
      onClick={() => onSelectCamper?.(camper.id)}
      style={{ cursor: 'grab', opacity: isDragging ? 0.4 : 1, fontSize: 13 }}
    >
      {camperName(camper)}
    </Paper>
  );
}

function LeafRow({
  leaf,
  days,
  onSelectCamper,
  onResize,
}: {
  leaf: AugmentedLodging;
  days: string[];
  onSelectCamper?: (camperId: number) => void;
  onResize: (camperId: number, stay: string[]) => void;
}) {
  const rowHeight = ROW_PAD * 2 + Math.max(1, leaf.campers.length) * (BAR_HEIGHT + BAR_GAP);
  const over = leaf.count > leaf.capacity && leaf.capacity > 0;

  return (
    <Group gap={0} wrap="nowrap" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
      <Box w={LABEL_WIDTH} px="xs" py={4} style={{ flexShrink: 0 }}>
        <Text size="sm" fw={500} lineClamp={1}>
          {leaf.name}
        </Text>
        <Text size="xs" c={over ? 'red' : 'dimmed'}>
          {leaf.count}/{leaf.capacity}
        </Text>
      </Box>
      <Box style={{ position: 'relative', height: rowHeight, width: days.length * DAY_WIDTH }}>
        {/* Day-cell droppables (also the grid lines). */}
        {days.map((d, i) => (
          <DayCell key={d} leafId={leaf.id} dayIndex={i} />
        ))}
        {/* Camper bars. */}
        {leaf.campers.map((c, row) => (
          <CamperBar
            key={c.id}
            camper={c}
            row={row}
            days={days}
            onSelectCamper={onSelectCamper}
            onResize={onResize}
          />
        ))}
      </Box>
    </Group>
  );
}

function DayCell({ leafId, dayIndex }: { leafId: number; dayIndex: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell:${leafId}:${dayIndex}` });
  return (
    <Box
      ref={setNodeRef}
      style={{
        position: 'absolute',
        left: dayIndex * DAY_WIDTH,
        top: 0,
        bottom: 0,
        width: DAY_WIDTH,
        borderLeft: '1px solid var(--mantine-color-default-border)',
        background: isOver ? 'var(--mantine-primary-color-light)' : undefined,
      }}
    />
  );
}

function CamperBar({
  camper,
  row,
  days,
  onSelectCamper,
  onResize,
}: {
  camper: ApiCamper;
  row: number;
  days: string[];
  onSelectCamper?: (camperId: number) => void;
  onResize: (camperId: number, stay: string[]) => void;
}) {
  const span = staySpan(camper.stay, days);
  const baseLen = span ? span.end - span.start + 1 : 1;
  const resizing = useRef<{ startX: number; startLen: number } | null>(null);
  const [previewLen, setPreviewLen] = useState<number | null>(null);
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `camper:${camper.id}`,
    data: { camper, length: baseLen } satisfies DragData,
  });

  if (!span) return null;
  const len = previewLen ?? baseLen;

  const onResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizing.current = { startX: e.clientX, startLen: baseLen };
    const move = (ev: PointerEvent) => {
      if (!resizing.current) return;
      const deltaCols = Math.round((ev.clientX - resizing.current.startX) / DAY_WIDTH);
      const maxLen = days.length - span.start;
      setPreviewLen(Math.min(Math.max(1, resizing.current.startLen + deltaCols), maxLen));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const deltaCols = Math.round((ev.clientX - (resizing.current?.startX ?? 0)) / DAY_WIDTH);
      const maxLen = days.length - span.start;
      const finalLen = Math.min(Math.max(1, (resizing.current?.startLen ?? baseLen) + deltaCols), maxLen);
      resizing.current = null;
      setPreviewLen(null);
      if (finalLen !== baseLen) onResize(camper.id, days.slice(span.start, span.start + finalLen));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <Box
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onSelectCamper?.(camper.id)}
      style={{
        position: 'absolute',
        left: span.start * DAY_WIDTH + 2,
        top: ROW_PAD + row * (BAR_HEIGHT + BAR_GAP),
        width: len * DAY_WIDTH - 4,
        height: BAR_HEIGHT,
        background: 'var(--mantine-primary-color-filled)',
        color: 'var(--mantine-color-white)',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        fontSize: 12,
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        userSelect: 'none',
      }}
    >
      <Text size="xs" lineClamp={1} style={{ flex: 1, color: 'inherit' }}>
        {camperName(camper)}
      </Text>
      {/* Right-edge resize handle (custom, per DR-6). */}
      <Box
        onPointerDown={onResizePointerDown}
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
    </Box>
  );
}
