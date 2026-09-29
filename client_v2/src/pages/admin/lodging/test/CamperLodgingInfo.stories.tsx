/**
 * Stories for CamperLodgingInfo (SPEC §8.6): a placed camper with everything
 * filled in, an unassigned one with little to go on, and the placed camper as a
 * Reporter sees it (no Unassign). Run `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { PermissionsProvider } from 'hooks/permissions';

import type { CamperLodgingDetails } from '../camperLodgingDetails';
import { CamperLodgingInfo } from '../CamperLodgingInfo';

const PLACED: CamperLodgingDetails = {
  camperId: 1,
  name: 'Bob Ross',
  assigned: 'Camp 1 → Cabin → Cabin 05',
  stay: ['2026-10-16', '2026-10-17', '2026-10-18'],
  requested: 'Camp 1 → Cabin',
  shared: true,
  sharedWith: 'Jane Ross',
  lodgingComments: 'Would like to be near the bathhouse.',
  unitNotes: 'The top bunk is broken; two beds only until it is fixed.',
  registrationType: 'Staff',
  registrationNotes: [{ label: 'Comments', text: 'Bob needs a lower bunk.' }],
  attributes: [
    { label: 'Age (at the beginning of camp)', text: '50-64 years old' },
    { label: 'Session', text: 'Full camp' },
    {
      label: 'Name badge',
      children: [
        { label: 'Name', text: 'Bob' },
        { label: 'Pronouns', text: 'he/him' },
      ],
    },
  ],
};

const UNASSIGNED: CamperLodgingDetails = {
  camperId: 2,
  name: 'Ani Skywalker',
  assigned: null,
  stay: [],
  requested: null,
  shared: false,
  sharedWith: '',
  lodgingComments: '',
  unitNotes: '',
  registrationType: null,
  registrationNotes: [],
  attributes: [],
};

const noop = () => undefined;

const Panel = ({ details }: { details: CamperLodgingDetails }) => (
  <Box p="md" maw={340}>
    <CamperLodgingInfo details={details} onOpenCamper={noop} onUnassign={noop} onClose={noop} />
  </Box>
);

export default { title: 'Camper Lodging Info' } satisfies Meta;

export const Placed: StoryFn = () => <Panel details={PLACED} />;

export const Unassigned: StoryFn = () => <Panel details={UNASSIGNED} />;

/** A Reporter can read the details but not unassign (DR-51). */
export const PlacedAsReporter: StoryFn = () => (
  <PermissionsProvider userRole="reporter">
    <Panel details={PLACED} />
  </PermissionsProvider>
);
