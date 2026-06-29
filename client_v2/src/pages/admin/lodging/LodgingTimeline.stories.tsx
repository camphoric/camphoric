/**
 * Ladle story for the LodgingTimeline (SPEC §8.6, DR-6). Seeds a small set of
 * leaves and campers in local state so dragging a camper into a day cell, moving
 * a bar, resizing it, and dragging back to "Unassigned" all visibly update.
 * Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Stack, Title } from '@mantine/core';
import type { ApiCamper, AugmentedLodging } from 'api-types';
import { useState } from 'react';

import { LodgingTimeline } from './LodgingTimeline';

const DAYS = ['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'];

const leaf = (id: number, name: string, fullPath: string, capacity: number): AugmentedLodging =>
  ({
    id,
    name,
    fullPath,
    capacity,
    isLeaf: true,
    children: [],
    campers: [],
    count: 0,
    maxCapacity: capacity,
    pathParts: fullPath.split('→'),
  }) as unknown as AugmentedLodging;

const LEAVES = [
  leaf(10, 'Cabin A', 'Camp→Cabin A', 2),
  leaf(11, 'Cabin B', 'Camp→Cabin B', 2),
  leaf(12, 'Tent 1', 'Camp→Tent 1', 1),
];

const BRANCHES = [{ id: 1, name: 'Camp', fullPath: '' } as unknown as AugmentedLodging];

const camper = (
  id: number,
  first: string,
  last: string,
  lodging: number | null,
  stay: string[] | null,
): ApiCamper =>
  ({ id, attributes: { first_name: first, last_name: last }, lodging, stay }) as unknown as ApiCamper;

const SEED: ApiCamper[] = [
  camper(1, 'Bob', 'Ross', 10, [DAYS[0], DAYS[1], DAYS[2]]),
  camper(2, 'Jane', 'Ross', 10, [DAYS[1], DAYS[2]]),
  camper(3, 'Buffy', 'Summers', 11, [DAYS[0], DAYS[1], DAYS[2], DAYS[3]]),
  camper(4, 'Ani', 'Skywalker', null, null),
  camper(5, 'Malcolm', 'Reynolds', null, null),
];

export const Assignment: Story = () => {
  const [campers, setCampers] = useState<ApiCamper[]>(SEED);

  const leaves = LEAVES.map((l) => {
    const assigned = campers.filter((c) => c.lodging === l.id);
    return { ...l, campers: assigned, count: assigned.length };
  });
  const unassigned = campers.filter((c) => c.lodging == null);

  return (
    <Stack p="md">
      <Title order={4}>Lodging timeline</Title>
      <LodgingTimeline
        days={DAYS}
        leaves={leaves}
        branches={BRANCHES}
        unassigned={unassigned}
        defaultStayLength={2}
        onAssign={(id, lodging, stay) =>
          setCampers((cs) => cs.map((c) => (c.id === id ? { ...c, lodging, stay } : c)))
        }
        onUnassign={(id) =>
          setCampers((cs) => cs.map((c) => (c.id === id ? { ...c, lodging: null, stay: null } : c)))
        }
      />
    </Stack>
  );
};
