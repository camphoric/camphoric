/**
 * Stories for the edit-lease notice (SPEC §9.8, DR-110): someone else is
 * editing the record. Run `npm run storybook`.
 */

import { Paper } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { EditLeaseNoticeView } from '../EditLeaseNotice';
import { ALEX_EDITING } from './leases';

export default { title: 'Edit Lease Notice' } satisfies Meta;

const frame = (props: { isYou?: boolean; overlapping?: boolean }) => (
  <Paper withBorder p="md" m="md" maw={560}>
    <EditLeaseNoticeView
      label="registration"
      lease={ALEX_EDITING}
      isYou={props.isYou ?? false}
      overlapping={props.overlapping ?? false}
      onTakeOver={() => undefined}
    />
  </Paper>
);

export const SomeoneElseIsEditing: StoryFn = () => frame({});
export const TheyTookItOver: StoryFn = () => frame({ overlapping: true });
export const YouInAnotherTab: StoryFn = () => frame({ isYou: true });
