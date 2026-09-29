/**
 * Story for the LodgingTimeline (SPEC §8.6, DR-6). Seeds a small lodging tree
 * and campers in local state so dragging a camper into a day cell, moving a
 * bar, resizing it, dragging back to "Unassigned", narrowing the view, and
 * selecting a camper all visibly update. The units sit under section headings
 * ("Camp 1 → Cabins"); "Off Site" is a top-level unit with no sub-units.
 * Run `npm run storybook`.
 */

import { Stack, Text, Title } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import type { ApiCamper, AugmentedLodging } from 'api-types';
import { PermissionsProvider } from 'hooks/permissions';
import { useState } from 'react';
import { camperName } from 'utils/camper';

import { LodgingTimeline } from '../LodgingTimeline';

const DAYS = ['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'];

const lodging = (
  id: number,
  parent: number | null,
  pathParts: string[],
  capacity: number,
  children: AugmentedLodging[] = [],
): AugmentedLodging =>
  ({
    id,
    parent,
    name: pathParts[pathParts.length - 1] ?? 'Lodging',
    fullPath: pathParts.join('→'),
    pathParts,
    capacity,
    maxCapacity: capacity,
    isLeaf: children.length === 0,
    children,
    campers: [],
    count: 0,
  }) as unknown as AugmentedLodging;

const CABIN_A = lodging(10, 3, ['Camp 1', 'Cabins', 'Cabin A'], 2);
const CABIN_B = lodging(11, 3, ['Camp 1', 'Cabins', 'Cabin B'], 2);
const TENT = lodging(12, 4, ['Camp 1', 'Tents', 'Tent 1'], 1);
const OFF_SITE = lodging(13, 1, ['Off Site'], 10);
const CABINS = lodging(3, 2, ['Camp 1', 'Cabins'], 0, [CABIN_A, CABIN_B]);
const TENTS = lodging(4, 2, ['Camp 1', 'Tents'], 0, [TENT]);
const CAMP = lodging(2, 1, ['Camp 1'], 0, [CABINS, TENTS]);

/** Every node under the root, in tree order (as the page offers them). */
const FILTER_NODES = [CAMP, CABINS, CABIN_A, CABIN_B, TENTS, TENT, OFF_SITE];
const LEAVES = FILTER_NODES.filter((n) => n.isLeaf);

const camper = (
  id: number,
  first: string,
  last: string,
  lodgingId: number | null,
  stay: string[] | null,
): ApiCamper =>
  ({
    id,
    attributes: { first_name: first, last_name: last },
    lodging: lodgingId,
    stay,
  }) as unknown as ApiCamper;

const SEED: ApiCamper[] = [
  camper(1, 'Bob', 'Ross', 10, [DAYS[0], DAYS[1], DAYS[2]]),
  camper(2, 'Jane', 'Ross', 10, [DAYS[1], DAYS[2]]),
  // The whole event: every day but the last, which is departure day.
  camper(3, 'Buffy', 'Summers', 11, [DAYS[0], DAYS[1], DAYS[2]]),
  camper(7, 'Kaylee', 'Frye', 13, [DAYS[0], DAYS[1]]),
  camper(4, 'Ani', 'Skywalker', null, null),
  camper(5, 'Malcolm', 'Reynolds', null, null),
  // Registration leaves a camper on the node they requested, often a branch: still unassigned.
  camper(6, 'River', 'Tam', 3, null),
];

export default { title: 'Lodging Timeline' } satisfies Meta;

export const Assignment: StoryFn = () => {
  const [campers, setCampers] = useState<ApiCamper[]>(SEED);
  const [shown, setShown] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<number>();

  const leaves = LEAVES.map((l) => {
    const assigned = campers.filter((c) => c.lodging === l.id);
    return { ...l, campers: assigned, count: assigned.length };
  });
  const unassigned = campers.filter((c) => !LEAVES.some((l) => l.id === c.lodging));
  const selected = campers.find((c) => c.id === selectedId);

  return (
    <Stack p="md">
      <Title order={4}>Lodging timeline</Title>
      <Text size="sm" data-testid="selected-camper">
        Selected: {selected ? camperName(selected) : 'nobody'}
      </Text>
      <LodgingTimeline
        days={DAYS}
        leaves={leaves}
        filterNodes={FILTER_NODES}
        shownLodgingIds={shown}
        onShownLodgingChange={setShown}
        unassigned={unassigned}
        defaultStayLength={2}
        onAssign={(id, lodgingId, stay) =>
          setCampers((cs) => cs.map((c) => (c.id === id ? { ...c, lodging: lodgingId, stay } : c)))
        }
        onUnassign={(id) =>
          setCampers((cs) => cs.map((c) => (c.id === id ? { ...c, lodging: null, stay: null } : c)))
        }
        selectedCamperId={selectedId}
        onSelectCamper={setSelectedId}
      />
    </Stack>
  );
};

/** A Reporter sees the timeline but can't drag or resize (DR-51). */
export const AsReporter: StoryFn = () => (
  <PermissionsProvider userRole="reporter">
    <Assignment />
  </PermissionsProvider>
);
