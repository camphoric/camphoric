/**
 * Ladle story for InlineDoc (SPEC §9.3): spec docs with `code` names. Run
 * `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Stack } from '@mantine/core';

import { InlineDoc } from './InlineDoc';

export const Doc: Story = () => (
  <Stack maw={560} p="md">
    <InlineDoc>
      {
        'Registrations that were started but not finished are in `incomplete_registrations`; `<b>` stays text.'
      }
    </InlineDoc>
  </Stack>
);
