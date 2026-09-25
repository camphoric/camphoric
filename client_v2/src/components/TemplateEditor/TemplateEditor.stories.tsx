/**
 * Ladle stories for the Jinja template editor (SPEC §9.6, DR-36). They use a
 * real variable spec (Camp Harmony's, trimmed) and a stand-in preview, so no
 * backend is needed: autocomplete, hover docs and highlighting are the real
 * thing; the preview flags `frist_name` as a typo and an unclosed tag as a
 * syntax error. Run `npm run ladle`.
 *
 * Try: `{{ event.` · `{% for camper in campers %}{{ camper.attributes.` ·
 * `{{ campers | ` · `{% `.
 */

import type { Story } from '@ladle/react';
import { Stack } from '@mantine/core';
import type { TemplateDiagnostic, TemplatePreviewOutput, TemplatePreviewResponse } from 'api-types';
import { useMemo, useState } from 'react';

import { sampleDescription } from './sampleDescription';
import { TemplateEditorView } from './TemplateEditor';

const CABIN_REPORT = `Name,Cabin,Nights
{%- for camper in campers | sort(attribute='lodging.full_name') %}
{{ camper.attributes.first_name | csv }},{{ camper.lodging.full_name | csv }},{{ camper.stay | length }}
{%- endfor %}
`;

const BALANCES = `# Balances for {{ event.name }}

{% for registration in registrations if registration.balance > 0 -%}
* {{ registration.registrant_email }}: {{ registration.balance | money }}
{% endfor %}`;

/** A stand-in for the server's preview: fixed output, simple checks. */
function fakePreview(template: string, output: TemplatePreviewOutput): TemplatePreviewResponse {
  const diagnostics: TemplateDiagnostic[] = [];
  template.split('\n').forEach((text, index) => {
    const column = text.indexOf('frist_name');
    if (column >= 0) {
      diagnostics.push({
        severity: 'warning',
        kind: 'undefined',
        message: "attributes:camper has no field 'frist_name'",
        field: 'template',
        line: index + 1,
        column: column + 1,
      });
    }
  });
  const opened = (template.match(/\{%-?\s*(for|if)\b/g) ?? []).length;
  const closed = (template.match(/\{%-?\s*end(for|if)\b/g) ?? []).length;
  if (opened > closed) {
    diagnostics.push({
      severity: 'error',
      kind: 'syntax',
      message: 'Unexpected end of template. Jinja was looking for an "endfor" or "endif" tag.',
      field: 'template',
      line: template.split('\n').length,
      column: null,
    });
  }
  const failed = diagnostics.some((d) => d.severity === 'error');
  const sample =
    output === 'csv'
      ? 'Name,Cabin,Nights\nPat,Cabins→Cabin A,2\nSam,Cabins→Cabin A,1\nLee,Tents→Tent 1,3\n'
      : '# Balances for Camp Harmony\n\n* pat@example.com: $725.00\n';
  return {
    output: failed ? '' : sample,
    diagnostics,
    truncated: false,
    duration_ms: 14,
    sample: null,
  };
}

function Editor({ initial, output }: { initial: string; output: TemplatePreviewOutput }) {
  const [value, setValue] = useState(initial);
  const preview = useMemo(() => fakePreview(value, output), [value, output]);
  return (
    <Stack p="md">
      <TemplateEditorView
        value={value}
        onChange={setValue}
        context="report"
        output={output}
        description={sampleDescription}
        preview={preview}
      />
    </Stack>
  );
}

export const CsvReport: Story = () => <Editor initial={CABIN_REPORT} output="csv" />;

export const MarkdownReport: Story = () => <Editor initial={BALANCES} output="md" />;

export const WithProblems: Story = () => (
  <Editor
    initial={'Name\n{% for camper in campers %}\n{{ camper.attributes.frist_name }}\n'}
    output="csv"
  />
);

export const Empty: Story = () => <Editor initial="" output="csv" />;

export const EditorOnly: Story = () => {
  const [value, setValue] = useState(CABIN_REPORT);
  return (
    <Stack p="md">
      <TemplateEditorView
        value={value}
        onChange={setValue}
        context="report"
        output="csv"
        description={sampleDescription}
        showPreview={false}
      />
    </Stack>
  );
};
