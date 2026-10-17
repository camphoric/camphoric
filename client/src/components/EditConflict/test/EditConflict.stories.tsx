/**
 * Stories for the edit conflict (SPEC §9.8, DR-109): a save refused because
 * someone else saved the record first. Run `npm run storybook`.
 */

import { Paper } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { EditConflictView } from '../EditConflict';
import { StaleRecordNotice } from '../StaleRecordNotice';
import { BASE, LABELS, MINE_APART, MINE_CLASH, THEIRS_APART, THEIRS_CLASH } from './conflicts';

export default { title: 'Edit Conflict' } satisfies Meta;

export const DifferentFields: StoryFn = () => (
  <Paper withBorder p="md" m="md" maw={560}>
    <EditConflictView
      label="registration"
      base={BASE}
      mine={MINE_APART}
      theirs={THEIRS_APART}
      fieldLabels={LABELS}
      onChoose={() => undefined}
    />
  </Paper>
);

export const SameField: StoryFn = () => (
  <Paper withBorder p="md" m="md" maw={560}>
    <EditConflictView
      label="registration"
      base={BASE}
      mine={MINE_CLASH}
      theirs={THEIRS_CLASH}
      fieldLabels={LABELS}
      onChoose={() => undefined}
    />
  </Paper>
);

export const StaleNotice: StoryFn = () => (
  <Paper withBorder p="md" m="md" maw={560}>
    <StaleRecordNotice label="registration" onLoadLatest={() => undefined} />
  </Paper>
);
