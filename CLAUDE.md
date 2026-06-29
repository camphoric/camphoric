# Camphoric — Working Notes

Camphoric is a camp registration and administration system. It has two parts:

- **`server/`** — a Django + Django REST Framework backend (the source of truth for data,
  pricing, persistence, and email).
- **`client/`** — a React + TypeScript single-page app with two surfaces: a public
  **registration** flow and an authenticated **admin** back-office.

## Front-end Client Spec
 
For a deep description of the client's behavior and architecture, see
[`SPEC_CLIENT_V2.md`](./SPEC_CLIENT_V2.md).

Keep this document up to date based on changes made to this project.

### Editing the Client Spec

`SPEC_CLIENT_V2.md` follows a specific methodology — preserve it when editing.

- **The body reads as plain specification.** It states *what to build* and how it behaves, in
  the present tense. Keep decision-framing words (“DECIDED”, “recommended”, “we should”,
  “leaning”, “alternatives considered”) **out** of the body — that reasoning lives in the
  Decision Records, not the prose a reader follows to build the client.
- **Record the “why” in Decision Records (§15).** When a notable choice is made (a library, an
  architecture, a process), add a new `### DR-N` entry with **Decision / Context / Alternatives**
  and reference it inline from the body as `(§15, DR-N)`. Append new DRs — don’t renumber or
  reuse existing ones, since other sections cite them by number.
- **Specify functionality and behavior, not UI.** Describe what the user can do and the rules
  that govern it; leave layout, navigation pattern, and whether something is a tab/modal/drawer/
  page to the implementer. Name a specific widget only as an *illustrative* example, never as a
  requirement. (See the “On UI prescription” note at the top of the spec.)
- **Keep the binding contracts explicit.** API request/response shapes, URL routes and which
  state is URL-addressable, pricing and validation rules, and the data written to each endpoint
  **are** requirements — call them out as such even while leaving the UI open.
- **Open Questions (§13) hold only genuine unresolved product/data calls.** When a question is
  resolved: state the outcome plainly in the body, add/update its Decision Record, and remove it
  from §13. Don’t leave a decided item lingering as “open”.
- **Keep cross-references consistent.** Section numbers and DR numbers are cited throughout —
  when you move, add, or resolve something, fix the references that point at it. The Contents
  list at the top should match the actual sections.
- **Bump the "Last updated" date.** Update the `Last updated:` line at the top of the spec on
  every edit (use the current date).

When making a change, mirror it in all the relevant places at once: the body statement, the
Decision Record, the open-questions list, the Contents list, the "Last updated" date, and any
cross-references — so the document never contradicts itself.

## Coding Standards

Abide by all principles in the [CONTRIBUTING.md](./CONTRIBUTING.md) document.

## Component Stories (Ladle)

The V2 client (`client_v2/`) uses [Ladle](https://ladle.dev) as its component workbench
(`npm run ladle`). **Every form widget — and any other reusable UI component — must ship with a
Ladle story when it's added.** Co-locate the story next to the component as
`<Component>.stories.tsx`, wrap usage in a story that exercises the component's states (and, for
form widgets, render them through the `JsonSchemaForm` engine with a representative schema so the
real rjsf wiring is covered). Stories use the CSF format and double as render targets for the
Playwright e2e suite, so keep them current as components change.

## Using Git

Do not automatically commit code to git. All changes shall be reviewed by the human coder and committed by hand.

Do suggest that code be committed after a change and suggest a commit title and message

