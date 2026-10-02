/**
 * Stories for the fee breakdown (SPEC §8.4, §8.5; §15, DR-56): plain, and
 * with an overridden line as a Registrar sees it (with actions) and as a
 * Reporter does (without), with an override that isn't in effect. Run
 * `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { FeeBreakdown } from '../FeeBreakdown';
import { CAMPER_LOGIC, OVERRIDDEN, STALE_OVERRIDE, TUITION_OVERRIDE } from './fixtures';

const noop = () => undefined;

export default { title: 'Fee Breakdown' } satisfies Meta;

export const Plain: StoryFn = () => (
  <Box p="md">
    <FeeBreakdown
      results={{ ...OVERRIDDEN, tuition: 920, overridden: undefined }}
      logics={[CAMPER_LOGIC]}
    />
  </Box>
);

export const OverriddenAsRegistrar: StoryFn = () => (
  <Box p="md">
    <FeeBreakdown
      results={OVERRIDDEN}
      logics={[CAMPER_LOGIC]}
      overrides={[TUITION_OVERRIDE, STALE_OVERRIDE]}
      overridable={['tuition', 'meals', 'parking']}
      onOverride={noop}
      onRemoveOverride={noop}
    />
  </Box>
);

export const OverriddenAsReporter: StoryFn = () => (
  <Box p="md">
    <FeeBreakdown results={OVERRIDDEN} logics={[CAMPER_LOGIC]} overrides={[TUITION_OVERRIDE]} />
  </Box>
);
