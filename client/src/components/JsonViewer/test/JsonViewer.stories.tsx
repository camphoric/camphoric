/**
 * Stories for the read-only JSON viewer (SPEC §9.6) behind the raw-record
 * debugging aids (§8): a small record, and one long enough to scroll in its
 * box. Run `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { JsonViewer } from '../JsonViewer';

const RECORD = {
  id: 42,
  event: 1,
  registrant_email: 'pat@example.com',
  attributes: { parking_passes: [{ type: 'Car' }], how_did_you_hear: 'A friend' },
  completed: true,
};

export default { title: 'Json Viewer' } satisfies Meta;

export const SmallRecord: StoryFn = () => (
  <Box p="md">
    <JsonViewer value={RECORD} />
  </Box>
);

export const Long: StoryFn = () => (
  <Box p="md">
    <JsonViewer value={Array.from({ length: 40 }, (_, index) => ({ ...RECORD, id: index + 1 }))} />
  </Box>
);
