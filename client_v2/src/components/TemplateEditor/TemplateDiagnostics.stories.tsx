/**
 * Ladle story for the template problems list (SPEC §9.6). Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Stack } from '@mantine/core';

import { TemplateDiagnostics } from './TemplateDiagnostics';

export const Problems: Story = () => (
  <Stack maw={720} p="md">
    <TemplateDiagnostics
      onJump={(d) => window.alert(`Jump to line ${d.line}`)}
      diagnostics={[
        {
          severity: 'warning',
          kind: 'undefined',
          message: "camper has no field 'frist_name'",
          field: 'template',
          line: 3,
          column: 12,
        },
        {
          severity: 'error',
          kind: 'syntax',
          message: "Encountered unknown tag 'endfro'.",
          field: 'template',
          line: 7,
          column: null,
        },
        {
          severity: 'error',
          kind: 'undefined',
          message: "registration has no field 'nope'",
          field: 'subject',
          line: 1,
          column: 17,
        },
        {
          severity: 'error',
          kind: 'timeout',
          message: 'The template took too long to render.',
          field: 'template',
          line: null,
          column: null,
        },
      ]}
    />
  </Stack>
);
