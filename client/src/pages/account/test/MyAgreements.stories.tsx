/**
 * Stories for the terms someone has agreed to (SPEC §6; §15 DR-145).
 * Run `npm run storybook`.
 */

import { Paper } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { PUBLISHED_CONTRACT } from 'components/Contract/test/contractFixtures';
import { AGREEMENTS } from 'pages/admin/contracts/test/contractVersions';

import { MyAgreementsList } from '../MyAgreementsModal';

export default { title: 'My Agreements' } satisfies Meta;

export const Agreed: StoryFn = () => (
  <Paper withBorder p="md" m="md" maw={760}>
    <MyAgreementsList agreements={[{ ...AGREEMENTS[0], contract: PUBLISHED_CONTRACT }]} />
  </Paper>
);
export const NoneYet: StoryFn = () => (
  <Paper withBorder p="md" m="md" maw={760}>
    <MyAgreementsList agreements={[]} />
  </Paper>
);
