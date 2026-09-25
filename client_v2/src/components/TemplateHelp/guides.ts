/**
 * Template Help guides (SPEC §9.3): short task-oriented pages for writing
 * server-rendered Jinja templates, plus the Handlebars helper reference. The
 * server's read-only error message points at "Template Help › Computed
 * values", so keep that title.
 */

import { templateHelpers } from 'components/templating';

export interface GuideTopic {
  id: string;
  title: string;
  /** Markdown. */
  body: string;
}

const fence = (code: string) => `\`\`\`jinja\n${code}\n\`\`\``;

const BASICS = `
A template is ordinary text with three kinds of Jinja markup:

- \`{{ … }}\` **outputs** a value: \`{{ event.name }}\`.
- \`{% … %}\` is a **tag** — a loop, a condition, an assignment: \`{% if camper.lodging %}\`.
- \`{# … #}\` is a **comment**, never output.

Values are reached with dots — \`camper.registration.registrant_email\` — and changed on the way
out with **filters** after a \`|\`: \`{{ registration.balance | money }}\`. Filters chain:
\`{{ campers | selectattr('lodging') | list | length }}\`.

Form answers live under \`attributes\`: \`{{ camper.attributes.first_name }}\`. A question
whose key isn't a plain name (it has a dash or a space) is written with brackets:
\`{{ registration.attributes['donation-note'] }}\`.

${fence(`{% if registration.balance > 0 %}
You owe {{ registration.balance | money }}.
{% else %}
You're paid up — thank you!
{% endif %}`)}

**Whitespace.** Every tag leaves its line break behind. Add a dash inside the tag to swallow
the whitespace on that side — \`{%-\` trims before, \`-%}\` trims after. CSV reports usually need
this so the output has no blank rows (see *Loops and sorting*).

**Missing values** print as nothing. Test for them with \`{% if value %}\`, \`is none\` or
\`is defined\`, or give a fallback: \`{{ camper.lodging.full_name | default('Unassigned') }}\`.

In the editor, type \`.\` after a variable to see its fields, \`|\` for filters and \`{%\` for
tags; hover over any name for its description.
`;

const LOOPS = `
${fence(`{% for camper in campers %}
{{ loop.index }}. {{ camper.attributes.first_name }}
{%- else %}
No campers yet.
{%- endfor %}`)}

Inside a loop, \`loop.index\` counts from 1 (\`loop.index0\` from 0), and \`loop.first\` /
\`loop.last\` are true on the first and last pass. Add a condition to skip items:
\`{% for camper in campers if camper.attributes.linens %}\`.

**Sorting** — by any field, including nested ones and several at once:

${fence(`{% for camper in campers | sort(attribute='attributes.last_name,attributes.first_name') %}`)}

Add \`reverse=true\` for descending order. Sorting on a value some items lack (such as the
lodging of an unassigned camper) fails, so filter those out first:
\`campers | selectattr('lodging') | sort(attribute='lodging.full_name')\`.

**Filtering** — \`selectattr\` keeps items whose attribute passes a test, \`rejectattr\` drops them:

${fence(`{{ registrations | selectattr('balance', 'gt', 0) | list | length }} registrations owe money`)}

**Grouping** — \`groupby\` gives one group per value, with \`grouper\` (the value) and \`list\`
(the items):

${fence(`{%- for group in campers | selectattr('lodging') | groupby('lodging.full_name') %}
## {{ group.grouper }}
{% for camper in group.list %}
* {{ camper.attributes.first_name }}
{%- endfor %}
{% endfor %}`)}

**A CSV report** — the header, then one row per camper, with dashes so no blank rows appear:

${fence(`Name,Cabin,Nights
{%- for camper in campers | sort(attribute='attributes.first_name') %}
{{ camper.attributes.first_name | csv }},{{ camper.lodging.full_name | csv }},{{ camper.stay | length }}
{%- endfor %}`)}

**One column per night:**

${fence(`Name{% for night in event.nights %},{{ night | date('%a %b %d') }}{% endfor %}
{%- for camper in campers %}
{{ camper.attributes.first_name | csv }}{% for night in event.nights %},{{ 'X' if night in camper.stay }}{% endfor %}
{%- endfor %}`)}
`;

const COMPUTED = `
Camphoric's objects — events, registrations, campers, lodging, and their lists — are
**read-only**: \`.update()\`, \`.append()\` and the like can't be used on them. Instead, build
your own values; lists and dicts you create can be changed freely.

**Your own list:**

${fence(`{%- set rows = [] %}
{%- for camper in campers %}
  {%- do rows.append({'name': camper.attributes.first_name, 'nights': camper.stay | length}) %}
{%- endfor %}
{%- for row in rows | sort(attribute='nights', reverse=true) %}
{{ row.name }}: {{ row.nights }}
{%- endfor %}`)}

**Adding fields to an object** — \`merge\` makes a new dict with the keys of both:

${fence(`{% set row = camper.attributes | merge({'cabin': camper.lodging.full_name}) %}`)}

**Running totals** — a plain \`{% set %}\` inside a loop is forgotten when the loop ends; use a
\`namespace\`, whose attributes can change:

${fence(`{%- set totals = namespace(owed=0, count=0) %}
{%- for registration in registrations if registration.balance > 0 %}
  {%- set totals.owed = totals.owed + registration.balance %}
  {%- set totals.count = totals.count + 1 %}
{%- endfor %}
{{ totals.count }} registrations owe {{ totals.owed | money }}`)}

Often a filter does it in one step: \`{{ registrations | sum(attribute='balance') | money }}\`,
\`{{ campers | map(attribute='lodging.full_name') | unique | list }}\`.

**Reusable pieces** — a macro is a small template with parameters:

${fence(`{% macro camper_name(camper) -%}
{{ camper.attributes.first_name }} {{ camper.attributes.last_name }}
{%- endmacro %}
{{ camper_name(campers | first) }}`)}
`;

const FORMATTING = `
**Money** values are exact decimals. \`money\` formats them:
\`{{ registration.balance | money }}\` → \`$1,234.50\` (and \`-$50.00\` for credits). Options:
\`money(symbol='')\`, \`money(places=0)\`, \`money(commas=false)\`. Pricing values
(\`registration.pricing.total\`, \`camper.pricing.tuition\`) are numbers — \`money\` formats those
too.

**Dates** (\`event.start\`, \`camper.stay\`, \`payment.paid_on\`) are real dates, so they compare
and sort correctly. Format them with \`date\`:

| Template | Output |
|---|---|
| \`{{ event.start | date }}\` | 2026-12-30 |
| \`{{ event.start | date('%a %b %d') }}\` | Wed Dec 30 |
| \`{{ event.start | date('%B %d, %Y') }}\` | December 30, 2026 |
| \`{{ registration.created_at | datetime('%b %d %H:%M') }}\` | Oct 01 05:00 |

Datetimes are shown in the camp's time zone. A date typed into a form is text; turn it into a
date with \`to_date\` to compare or format it: \`{{ camper.attributes.birthdate | to_date | date('%m/%d/%Y') }}\`.
\`today\` and \`now\` are available in reports.

**CSV** — a value containing a comma, quote or line break must be quoted. \`csv\` does that
only when needed; \`csv_row\` builds a whole line from a list:

${fence(`{{ camper.attributes.comments | csv }}
{{ [camper.attributes.first_name, camper.lodging.full_name, camper.pricing.total] | csv_row }}`)}

**Markdown tables** — \`md_cell\` escapes \`|\` and line breaks:
\`| {{ camper.attributes.comments | md_cell }} |\`.

**HTML reports** are escaped automatically, so answers can't break the page; mark trusted HTML
with \`safe\`.
`;

const LODGING = `
\`camper.lodging\` is the place a camper is assigned (or empty); \`lodging\` is the root of the
event's lodging tree, and \`lodgings\` lists every node.

| Field | Meaning |
|---|---|
| \`name\` | This node's own name, e.g. \`Cabin 4\` |
| \`full_name\` | The path from below the root, e.g. \`Cabins→Cabin 4\` |
| \`path_names\` | The same path as a list: \`['Cabins', 'Cabin 4']\` |
| \`parent\` / \`children\` / \`ancestors\` | Neighbouring nodes |
| \`campers\` | Campers assigned here |
| \`all_campers\` / \`camper_count\` | Campers here or anywhere below |
| \`capacity\` / \`remaining_capacity\` | Places, and places left |
| \`is_leaf\` / \`depth\` | No children; levels below the root |

**A roster by place** (every node with campers assigned to it):

${fence(`{%- for place in lodgings if place.campers %}
## {{ place.full_name }} ({{ place.campers | length }}/{{ place.capacity }})
{% for camper in place.campers %}
* {{ camper.attributes.first_name }} {{ camper.attributes.last_name }}
{%- endfor %}
{% endfor %}`)}

**The whole tree**, indented — a \`recursive\` loop calls \`loop(…)\` for the children:

${fence(`{%- for place in lodging.children recursive %}
{{ '  ' * (place.depth - 1) }}{{ place.name }}: {{ place.camper_count }}
{%- if place.children %}{{ loop(place.children) }}{% endif %}
{%- endfor %}`)}

Lodging requests are on the camper too: \`lodging_requested\`, \`lodging_shared\`,
\`lodging_shared_with\`, \`lodging_comments\`.
`;

const ERRORS = `
Problems are listed under the preview and underlined in the template; choose one to jump to it.

- **"camper has no field 'frist_name'"** (a warning) — a misspelled field. It prints nothing;
  fix the name (the editor's suggestions list the real ones). For form answers, check the key
  under \`attributes\`.
- **"'None' has no attribute …"** — something in the middle of a chain is empty, such as
  \`camper.lodging.parent.name\` for an unassigned camper. Check first
  (\`{% if camper.lodging %}\`) or use \`default\`.
- **"Camphoric's objects are read-only …"** — \`.update()\` or \`.append()\` on a Camphoric
  object. Build your own list or dict (*Computed values*).
- **"Unexpected end of template …"** / **"Encountered unknown tag …"** — an \`{% if %}\` or
  \`{% for %}\` without its \`{% endif %}\` / \`{% endfor %}\`, or a misspelled tag.
- **"expected token …"** — a syntax slip inside \`{{ }}\`/\`{% %}\`: a missing quote,
  parenthesis or comma.
- **"The template took too long"** / **"The output is longer than …"** — a loop inside a loop
  over everything, usually. Loop over what you need (\`registration.campers\` rather than all
  \`campers\` filtered by registration).
- **Blank rows in a CSV** — add dashes to the tags: \`{%- for … %}\` / \`{%- endfor %}\`.
- **Something unsafe** — templates can't reach Python internals (names starting with \`_\`) or
  change data.

To see exactly what a value contains, print it: \`{{ camper | dump }}\`. Linked objects are
shown two levels deep; deeper ones appear as \`{"$ref": "registration:12"}\`. The standalone
Template Help page can also download a sample of every variable.
`;

const LEGACY = `
Legacy reports receive a bundle the browser uploads, joined through lookup tables. Reports with
Camphoric variables get linked objects instead:

| Legacy report | Camphoric variables |
|---|---|
| \`lodgingLookup[camper.lodging | string]\` | \`camper.lodging\` |
| \`lodgingLookup[…].fullPath\` / \`pathParts\` | \`camper.lodging.full_name\` / \`path_names\` |
| \`registrationLookup[camper.registration | string]\` | \`camper.registration\` |
| \`registrationTypeLookup[…]\` | \`registration.registration_type\` |
| \`camperLookup[id]\` | \`registration.campers\`, or the camper itself |
| \`registration.server_pricing_results.total\` | \`registration.pricing.total\` or \`registration.total_owed\` |
| \`registration.total_payments\` / \`total_balance\` | \`registration.total_paid\` / \`balance\` |
| \`camper.server_pricing_results\` | \`camper.pricing\` |
| \`camper.sequence\` | \`camper.index\` (0 for the first camper) |
| \`camper.stay\` (text dates) | \`camper.stay\` (real dates) |
| a hard-coded \`{% set dates = [...] %}\` | \`event.nights\` or \`event.days\` |
| \`{% do camper.update({...}) %}\` | \`camper.attributes | merge({...})\`, or your own list |
| \`money_fmt\` | \`money\` |

Only completed registrations (and their campers and payments) are in \`registrations\`,
\`campers\` and \`payments\`, as before; the rest are in \`incomplete_registrations\`.
`;

const MUSTACHE = `
Emails written in Mustache move to Jinja like this.

**Confirmation email**

| Mustache | Jinja |
|---|---|
| \`{{registration.registrant_email}}\` | \`{{ registration.registrant_email }}\` |
| \`{{#campers}} … {{/campers}}\` | \`{% for camper in campers %} … {% endfor %}\` |
| \`{{first_name}}\` (inside campers) | \`{{ camper.attributes.first_name }}\` |
| \`{{pricing_result.total}}\` (inside campers) | \`{{ camper.pricing.total | money }}\` |
| \`{{lodging}}\` / \`{{lodging_full}}\` | \`{{ camper.lodging.name }}\` / \`{{ camper.lodging.full_name }}\` |
| \`{{pricing_results.total}}\` | \`{{ pricing.total | money }}\` |
| \`{{initial_payment}}\` | \`{{ initial_payment | money }}\` |

**Invitation email**

| Mustache | Jinja |
|---|---|
| \`{{recipient_name}}\` | \`{{ invitation.recipient_name or invitation.recipient_email }}\` |
| \`{{recipient_email}}\` | \`{{ invitation.recipient_email }}\` |
| \`{{invitation_code}}\` | \`{{ invitation.code }}\` |
| \`{{register_link}}\` | \`{{ invitation.register_url }}\` |

**Sections and conditions**

| Mustache | Jinja |
|---|---|
| \`{{#value}} … {{/value}}\` (a condition) | \`{% if value %} … {% endif %}\` |
| \`{{^value}} … {{/value}}\` | \`{% if not value %} … {% endif %}\` |
| \`{{{value}}}\` | \`{{ value }}\` (emails aren't HTML-escaped) |

Mustache printed \`none\` for an unassigned lodging; Jinja prints nothing — use
\`{{ camper.lodging.name | default('none') }}\` to keep the old wording.
`;

/** Handlebars helpers, from each helper's `help` (example, result, description). */
function handlebarsHelpers(): string {
  const rows = Object.entries(templateHelpers).map(([name, { help }]) => {
    const [example = '', result = '', ...description] = help.trim().split('\n');
    return `### ${name}\n\n${description.join(' ').trim()}\n\n\`\`\`handlebars\n${example}\n\`\`\`\n\nGives: \`${result}\``;
  });
  return `
Handlebars templates — event descriptions, the pre-submit message, and Handlebars
(\`hbs\`) reports — render in the browser. Besides standard Handlebars (\`{{#each}}\`,
\`{{#if}}\`), they can use these helpers.

${rows.join('\n\n')}
`;
}

/**
 * In a markdown table row, a `|` inside inline code still splits the cell;
 * escape those so filters (`value | money`) show intact.
 */
export function escapeTablePipes(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) =>
      line.startsWith('|')
        ? line.replace(/`[^`]*`/g, (code) => code.replace(/(?<!\\)\|/g, '\\|'))
        : line,
    )
    .join('\n');
}

const topic = (id: string, title: string, body: string): GuideTopic => ({
  id,
  title,
  body: escapeTablePipes(body),
});

export const GUIDE_TOPICS: GuideTopic[] = [
  topic('basics', 'Jinja basics', BASICS),
  topic('loops', 'Loops and sorting', LOOPS),
  topic('computed', 'Computed values', COMPUTED),
  topic('formatting', 'Money, dates and CSV', FORMATTING),
  topic('lodging', 'Lodging', LODGING),
  topic('errors', 'Common errors', ERRORS),
  topic('legacy', 'From legacy reports', LEGACY),
  topic('mustache', 'From Mustache emails', MUSTACHE),
  topic('handlebars', 'Handlebars helpers', handlebarsHelpers()),
];

export const DEFAULT_TOPIC = GUIDE_TOPICS[0].id;

export function guideTopic(id: string | undefined): GuideTopic {
  return GUIDE_TOPICS.find((topic) => topic.id === id) ?? GUIDE_TOPICS[0];
}
