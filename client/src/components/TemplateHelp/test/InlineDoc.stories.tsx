/**
 * Story for InlineDoc (SPEC §9.3): spec docs with `code` names. Run
 * `npm run storybook`.
 */

import { Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { InlineDoc } from '../InlineDoc';

export default { title: 'Inline Doc' } satisfies Meta;

export const Doc: StoryFn = () => (
  <Stack maw={560} p="md">
    <InlineDoc>
      {
        'Registrations that were started but not finished are in `incomplete_registrations`; `<b>` stays text.'
      }
    </InlineDoc>
  </Stack>
);
