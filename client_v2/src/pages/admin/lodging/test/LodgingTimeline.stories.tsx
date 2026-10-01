/**
 * Story for the LodgingTimeline (SPEC §8.6, DR-6). Seeds a small lodging tree
 * and campers in local state so dragging a camper into a day cell, moving a
 * bar, resizing it, dragging back to "Unassigned", narrowing the view, and
 * selecting a camper all visibly update. The units sit under section headings
 * ("Camp 1 → Cabins"); "Off Site" is a top-level unit with no sub-units. Cabin
 * A, Tent 1, and the Cabins section carry notes, marked by an icon; selecting a
 * unit or section by its name shows its details, notes included, alongside.
 * Run `npm run storybook`.
 */

import { Grid, Stack, Text, Title } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import type { ApiCamper } from 'api-types';
import { PermissionsProvider } from 'hooks/permissions';
import { useState } from 'react';
import { camperName } from 'utils/camper';

import { LodgingDetailsPanel } from '../LodgingDetailsPanel';
import { LodgingTimeline } from '../LodgingTimeline';
import { CAMPERS, DAYS, FILTER_NODES, leavesWith, unassignedIn } from './lodgingFixtures';

export default { title: 'Lodging Timeline' } satisfies Meta;

export const Assignment: StoryFn = () => {
  const [campers, setCampers] = useState<ApiCamper[]>(CAMPERS);
  const [shown, setShown] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<number>();
  const [selectedLodgingId, setSelectedLodgingId] = useState<number>();

  const leaves = leavesWith(campers);
  const unassigned = unassignedIn(campers);
  const selected = campers.find((c) => c.id === selectedId);
  // A selected unit carries its campers; a selected section is shown as listed.
  const selectedLodging = [...leaves, ...FILTER_NODES].find((n) => n.id === selectedLodgingId);

  return (
    <Stack p="md">
      <Title order={4}>Lodging timeline</Title>
      <Text size="sm" data-testid="selected-camper">
        Selected: {selected ? camperName(selected) : 'nobody'}
      </Text>
      <Grid>
        <Grid.Col span={selectedLodging ? 9 : 12}>
          <LodgingTimeline
            days={DAYS}
            leaves={leaves}
            filterNodes={FILTER_NODES}
            shownLodgingIds={shown}
            onShownLodgingChange={setShown}
            unassigned={unassigned}
            defaultStayLength={2}
            onAssign={(id, lodgingId, stay) =>
              setCampers((cs) =>
                cs.map((c) => (c.id === id ? { ...c, lodging: lodgingId, stay } : c)),
              )
            }
            onUnassign={(id) =>
              setCampers((cs) =>
                cs.map((c) => (c.id === id ? { ...c, lodging: null, stay: null } : c)),
              )
            }
            selectedCamperId={selectedId}
            onSelectCamper={setSelectedId}
            selectedLodgingId={selectedLodgingId}
            onSelectLodging={setSelectedLodgingId}
          />
        </Grid.Col>
        {selectedLodging && (
          <Grid.Col span={3}>
            <LodgingDetailsPanel
              node={selectedLodging}
              onClose={() => setSelectedLodgingId(undefined)}
            />
          </Grid.Col>
        )}
      </Grid>
    </Stack>
  );
};

/** A Reporter sees the timeline but can't drag or resize (DR-51). */
export const AsReporter: StoryFn = () => (
  <PermissionsProvider userRole="reporter">
    <Assignment />
  </PermissionsProvider>
);
