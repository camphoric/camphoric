/**
 * Ladle stories for the fee breakdown (SPEC §8.4, §8.5; §15, DR-56): plain,
 * with an overridden line as a Registrar sees it (with actions) and as a
 * Reporter does (without), an override that isn't in effect, and a waived
 * handling fee. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Box } from '@mantine/core';

import { FeeBreakdown } from '../FeeBreakdown';
import {
  CAMPER_LOGIC,
  HANDLING_OVERRIDE,
  HANDLING_WAIVED,
  OVERRIDDEN,
  REGISTRATION_LOGIC,
  STALE_OVERRIDE,
  TUITION_OVERRIDE,
} from './fixtures';

const noop = () => undefined;

export const Plain: Story = () => (
  <Box p="md">
    <FeeBreakdown
      results={{ ...OVERRIDDEN, tuition: 920, overridden: undefined }}
      logics={[CAMPER_LOGIC]}
    />
  </Box>
);

export const OverriddenAsRegistrar: Story = () => (
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

export const OverriddenAsReporter: Story = () => (
  <Box p="md">
    <FeeBreakdown results={OVERRIDDEN} logics={[CAMPER_LOGIC]} overrides={[TUITION_OVERRIDE]} />
  </Box>
);

export const HandlingWaived: Story = () => (
  <Box p="md">
    <FeeBreakdown
      results={HANDLING_WAIVED}
      logics={[REGISTRATION_LOGIC]}
      overrides={[HANDLING_OVERRIDE]}
      overridable={['donation', 'handling']}
      onOverride={noop}
      onRemoveOverride={noop}
    />
  </Box>
);
