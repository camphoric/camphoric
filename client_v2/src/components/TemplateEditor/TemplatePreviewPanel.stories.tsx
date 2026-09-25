/**
 * Ladle stories for the template preview panel (SPEC §9.6): each output
 * format, problems, a cut-off result and a failed request. Run
 * `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Stack } from '@mantine/core';
import type { TemplatePreviewResponse } from 'api-types';

import { TemplatePreviewPanel } from './TemplatePreviewPanel';

const base: TemplatePreviewResponse = {
  output: '',
  diagnostics: [],
  truncated: false,
  duration_ms: 18,
  sample: null,
};

const wrap = (node: React.ReactNode) => (
  <Stack maw={720} p="md">
    {node}
  </Stack>
);

export const Csv: Story = () =>
  wrap(
    <TemplatePreviewPanel
      output="csv"
      preview={{ ...base, output: 'Name,Cabin\nPat,Cabins→Cabin A\nLee,Tents→Tent 1\n' }}
    />,
  );

export const Markdown: Story = () =>
  wrap(
    <TemplatePreviewPanel
      output="md"
      preview={{
        ...base,
        output: '# Balances\n\n| Email | Balance |\n|---|---|\n| pat@example.com | $725.00 |\n',
      }}
    />,
  );

export const Html: Story = () =>
  wrap(
    <TemplatePreviewPanel
      output="html"
      preview={{
        ...base,
        output: '<h2 style="color: teal">Roster</h2><ul><li>Pat</li><li>Lee</li></ul>',
      }}
    />,
  );

export const Text: Story = () =>
  wrap(
    <TemplatePreviewPanel
      output="txt"
      preview={{ ...base, output: 'Pat  Cabin A\nLee  Tent 1' }}
      rendering
    />,
  );

export const Email: Story = () =>
  wrap(
    <TemplatePreviewPanel
      output="email"
      preview={{
        ...base,
        subject: 'Welcome to Camp Harmony, Pat',
        output: '# Hi Pat',
        html: '<h1>Hi Pat</h1><p>Your balance is <strong>$725.00</strong>.</p>',
        sample: { kind: 'registration', id: 12, label: 'Registration #12 (pat@example.com)' },
      }}
    />,
  );

export const WithProblems: Story = () =>
  wrap(
    <TemplatePreviewPanel
      output="csv"
      onJump={(d) => window.alert(`Jump to line ${d.line}`)}
      preview={{
        ...base,
        output: 'Name\nPat\n',
        truncated: true,
        diagnostics: [
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
            kind: 'output_limit',
            message: 'The output is longer than 2,000,000 characters and was cut off.',
            field: 'template',
            line: null,
            column: null,
          },
        ],
      }}
    />,
  );

export const RequestFailed: Story = () =>
  wrap(
    <TemplatePreviewPanel
      output="csv"
      error="registration_id: No such registration in this event."
    />,
  );
