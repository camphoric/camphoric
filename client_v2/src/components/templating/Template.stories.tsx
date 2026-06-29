/**
 * Ladle stories for the templating engine — a live playground for the Handlebars
 * helpers, the markdown pipeline, sanitization, and the error fallback. Run
 * `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Code, Divider, Stack, Textarea, Title } from '@mantine/core';
import { Template } from 'components/templating';
import { useState } from 'react';

/** Sample report-style variables used by the helper examples. */
const sampleVars = {
  campers: [
    { id: '1', attributes: { first_name: 'Bob', age: 9 } },
    { id: '2', attributes: { first_name: 'Abby', age: 7 } },
  ],
  camperLookup: {
    '1': { attributes: { first_name: 'Bob' } },
    '2': { attributes: { first_name: 'Abby' } },
  },
};

/** Plain GFM markdown rendering. */
export const Markdown: Story = () => (
  <Stack p="md" maw={640}>
    <Template
      markdown={
        '# Heading\n\nSome **bold** and _italic_ text, plus a list:\n\n- one\n- two\n- three\n\n| a | b |\n| - | - |\n| 1 | 2 |'
      }
    />
  </Stack>
);

/** Handlebars helpers rendered against `sampleVars`. */
export const Helpers: Story = () => (
  <Stack p="md" maw={640}>
    <Template
      markdown={[
        '- Total campers: {{count campers}}',
        "- Look up camper 1: {{getCamperValue '1' 'attributes.first_name'}}",
        "- Sorted by name: {{#eachsort campers 'attributes.first_name'}}{{attributes.first_name}} {{/eachsort}}",
        '- Sum of ages: {{sum 9 7}}',
      ].join('\n')}
      templateVars={sampleVars}
    />
  </Stack>
);

/** Sanitization: scripts are stripped; class/style on div/span are kept; external links open in a new tab. */
export const Sanitization: Story = () => (
  <Stack p="md" maw={640}>
    <Template
      markdown={[
        '<div class="note" style="color: tomato">Styled div is allowed.</div>',
        '',
        "<script>alert('blocked')</script>",
        '',
        '[External link](https://example.com) opens in a new tab.',
      ].join('\n')}
    />
  </Stack>
);

/** A render failure shows the error in a <pre> rather than crashing. */
export const RenderError: Story = () => (
  <Stack p="md" maw={640}>
    {/* {{count 5}} throws (non-array) and is caught by the component. */}
    <Template markdown="{{count 5}}" />
  </Stack>
);

/** Edit a template live against the sample variables. */
export const Playground: Story = () => {
  const [markdown, setMarkdown] = useState(
    "Hello **{{getCamperValue '1' 'attributes.first_name'}}** — {{count campers}} campers.",
  );
  return (
    <Stack p="md" maw={720}>
      <Title order={5}>Template</Title>
      <Textarea
        value={markdown}
        onChange={(event) => setMarkdown(event.currentTarget.value)}
        autosize
        minRows={4}
      />
      <Title order={6}>Variables</Title>
      <Code block>{JSON.stringify(sampleVars, null, 2)}</Code>
      <Divider label="Rendered" />
      <Template markdown={markdown} templateVars={sampleVars} />
    </Stack>
  );
};
