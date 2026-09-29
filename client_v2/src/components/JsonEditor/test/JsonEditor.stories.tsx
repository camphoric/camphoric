/**
 * Ladle stories for the Monaco code editor (SPEC §9.6, DR-8), bundled with the
 * app (DR-58). JSON is checked by Monaco's JSON worker, so the invalid story's
 * underline shows the worker loaded; the legacy report formats are highlighted
 * only. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { useState } from 'react';

import { JsonEditor } from '../JsonEditor';

const SETTINGS = `{
  "title": "Camp registration",
  "type": "object",
  "required": ["first_name"],
  "properties": {
    "first_name": { "type": "string", "title": "First name" },
    "nights": { "type": "integer", "minimum": 1 }
  }
}`;

// A missing comma after "Camp registration".
const INVALID = SETTINGS.replace('"Camp registration",', '"Camp registration"');

const HANDLEBARS = `<h1>{{event.name}}</h1>
{{#each campers}}
  <p>{{attributes.first_name}} — {{lodging.name}}</p>
{{/each}}`;

const MARKDOWN = `# Balances

* **Pat Alpha**: $825.00
* **Lee Beta**: $400.00`;

function Editor({ initial, language }: { initial: string; language?: string }) {
  const [value, setValue] = useState(initial);
  return <JsonEditor value={value} onChange={setValue} language={language} height={260} />;
}

export const Json: Story = () => <Editor initial={SETTINGS} />;
export const InvalidJson: Story = () => <Editor initial={INVALID} />;
export const Handlebars: Story = () => <Editor initial={HANDLEBARS} language="handlebars" />;
export const Markdown: Story = () => <Editor initial={MARKDOWN} language="markdown" />;
