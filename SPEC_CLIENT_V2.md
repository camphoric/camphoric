# Camphoric Client (Frontend) — Specification

**Status:** Living draft for the V2 client rebuild — see §15 (Decision Records) for the
decision history.
**Last updated:** 2026-10-05

> **Note:** this is a *rebuild* (V2) spec. Once the rebuild ships, it will be renamed and
> rewritten as the *current* client spec — at which point the migration rationale (the "the
> current implementation used …" notes) and much of the Decision Records will naturally be
> trimmed away.

## Contents

- §1 — Goals and Scope
- §2 — Technology Stack and Build
- §3 — Application Bootstrap
- §4 — Routing
- §5 — State Management and API Contract
- §6 — Authentication
- §7 — Registration Flow (Public)
- §8 — Admin Application
- §9 — Shared Systems
- §10 — Cross-Cutting Concerns
- §11 — Non-Functional Requirements
- §12 — Behaviors to Preserve (and Pitfalls to Improve in V2)
- §13 — Open Questions and Decisions to Resolve
- §14 — Future Feature: Plugin System
- §15 — Decision Records (DR-1…DR-103)
- Appendix A — Backend / API Dependencies
- Appendix B — Suggested Build Order

---

This document specifies the behavior and architecture of the Camphoric web client
(`client/`). It is written as a build specification for a fresh implementation of the
frontend (a "V2"), reconstructed from the current implementation. It describes *what the
client must do* and the contracts it depends on, rather than prescribing the exact code
structure or UI presentation, so a new version is free to choose its own internal organization
and interface design while preserving behavior.

Camphoric is a camp registration and administration system. The frontend is a single-page
application with two distinct user-facing surfaces that share a common foundation:

1. **Registration** — a public, multi-step flow where a registrant signs up campers for an
   event and pays.
2. **Admin** — an authenticated back-office for organizers to configure events, manage
   registrations/campers/payments, assign lodging, send invitations, and generate reports.

**On UI prescription.** This spec states required *functionality and behavior*. How the UI
realizes it — overall layout, navigation pattern, and whether a given capability is a tab,
modal, drawer, inline panel, or separate page — is deliberately left to the implementer, who
should favor clarity, consistency, and accessibility using the toolkit in §2. Where this
document names a specific widget (a "tab", "modal", "list", "table", "button"), read it as one
acceptable realization, not a mandate. What is **not** a UI choice and **is** binding: API
request/response shapes, URL routes and which state is URL-addressable, pricing and validation
rules, and the data written to each endpoint — these are called out as requirements throughout.
Two placements are also house conventions rather than free choices: where a screen's way back
goes (§9.6, *Way back*), and the light/dark choice at the top right of every page (§9.6, *Light
or dark mode*).

---

## 1. Goals and Scope

- Render fully data-driven registration forms from server-provided JSON Schema, with custom
  field types specific to camp registration (multiple campers, addresses, lodging requests).
- Compute registration pricing **client-side in real time** as the user edits the form, using
  server-provided pricing logic, while keeping the result identical to the server's
  authoritative calculation.
- Support multiple payment methods (pay-by-check and PayPal/credit card) with optional
  deposit options and electronic-payment handling fees, keeping every payment on an invoice
  (§9.7).
- Provide a complete admin back-office driven by the same JSON Schema engine, where event
  configuration (schemas, pricing, templates, email) is itself editable as data.
- Let organizers define **reports** as templates (Jinja-on-server or Handlebars-on-client)
  over the event's data, with CSV/Markdown/Text/HTML output.
- Manage hierarchical **lodging** with drag-and-drop, date-range stays, and capacity tracking.

Out of scope for the client: authoritative pricing, persistence, email sending, PDF/Jinja
rendering — these are server responsibilities. The client mirrors pricing for UX only.
**Non-goals (V2):** internationalization and multi-currency — the client is English/USD only
(see §15, DR-18).

---

## 2. Technology Stack and Build

This is the **V2 stack chosen during this spec**. It deliberately differs from the current
implementation (which used Redux Toolkit + RTK Query, React-Bootstrap, `moment`, React Router
v5, and `react-grid-layout`). A V2 may still substitute equivalents, but must preserve the
behaviors specified throughout this document.

- **Language/Framework:** React (function components + hooks) in TypeScript.
- **Build tool:** Vite. Dev server on port 3000; build output to `build/` with hashed assets
  under `static/`.
- **Server-state / data fetching:** TanStack Query (React Query) for all API reads and
  mutations, with query-key invalidation (see §5).
- **Client state:** Zustand for the small amount of genuine client state (the in-progress
  registration in the public flow); component state + URL query params for everything else.
- **Routing:** TanStack Router — nested routes, route guards, lazy/code-split routes, and
  typed, validated search params (see §4).
- **Forms:** React JSON Schema Form (**rjsf v6**, the latest major) with the official
  **`@rjsf/mantine`** theme, plus the custom fields/widgets/templates (see §9.1).
- **Phone input:** `react-international-phone` (its `usePhoneInput` hook composed with Mantine
  inputs) for the international phone widget — lighter than `react-phone-number-input` and
  Mantine-native (see §15, DR-30).
- **Pricing logic:** `json-logic-js` to evaluate server-provided pricing expressions.
- **Templating:** `handlebars` for variable substitution + a `unified`/`remark`/`rehype`
  markdown→HTML pipeline with sanitization.
- **UI kit:** Mantine **v8** (core + `@mantine/hooks`; `@mantine/dates` for date inputs,
  `@mantine/modals` for dialogs; `@mantine/form` for non-schema forms like login), with
  `@tabler/icons-react` for icons. v8 is required by the official `@rjsf/mantine` v6 theme
  (§15, DR-4) and keeps the CSS-Modules/PostCSS styling model (DR-24).
- **Payments:** PayPal JS SDK (`@paypal/react-paypal-js`).
- **Search:** `match-sorter` for lightweight client-side filtering/ranking of smaller admin
  lists (predictable starts-with → contains → acronym → fuzzy ranking). See §15, DR-20.
- **Data tables:** headless `@tanstack/react-table` rendered with Mantine `Table` primitives for
  sortable, filterable, paginated admin tables; fuzzy column/global filtering uses
  `match-sorter`. Sort/filter/pagination run **client-side** over the full
  per-event dataset (which tops out around 500–700 campers — DR-25), with table state held in
  TanStack Router search params. (Headless TanStack Table is the lean alternative; see §15,
  DR-19.)
- **Editors:** Monaco (`@monaco-editor/react`) for editing JSON schemas and report templates in
  admin (single editor; see §15, DR-8). Monaco is bundled with the app (`monaco-editor`), not
  fetched from a CDN (§15, DR-58).
- **Dates:** Luxon (`DateTime`) for parsing/formatting with explicit timezone handling
  (immutable values; use `setZone`/`toISODate`/`toFormat` rather than mutation).
- **CSV:** `d3-dsv` (`csvParseRows`) to parse server-produced CSV report output into rows for a
  table preview (see §15, DR-21).
- **Address autocomplete:** Google Maps **Places API (New)** — the `PlaceAutocompleteElement`
  (with `@types/google.maps`) — injected at runtime when an API key is configured (see §15,
  DR-23).
- **Drag and drop:** `dnd-kit` (`@dnd-kit/core` + `@dnd-kit/sortable`) for the unassigned-
  camper → lodging-grid drops and the camper reorder lists. See §8.6 for the timeline/resize
  consideration.
- **Linting & formatting:** ESLint v9 (flat config) + `typescript-eslint` (type-checked) +
  Prettier, with `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`,
  `@tanstack/eslint-plugin-query`, import sorting, and `eslint-config-prettier`. Surface it in
  the dev server (`vite-plugin-checker`) and enforce in CI and a pre-commit hook
  (`husky` + `lint-staged`). See §15 (Decision Records) for rationale and alternatives.
- **Styling:** Mantine CSS Modules + PostCSS (`postcss-preset-mantine`) — not Sass (see §15,
  DR-24).
- **Utilities:** no `lodash` — optional chaining for property access, and `@mantine/hooks`
  (`useDebouncedValue`/`useDebouncedCallback` for debouncing, `useDocumentTitle` for the document
  title) in place of `lodash` and `react-helmet`. Reach for `es-toolkit` only if a utility belt
  is genuinely needed (see §15, DR-22).

### Dev/proxy

- API calls go to `/api/*`. In development the dev server proxies `/api` to the Django
  backend (default `http://localhost:8000/`, configurable via env). In production the client
  is served as static assets and `/api` is served by the same origin.
- Module path aliases exist for `components`, `hooks`, `navigation`, `pages`, `store`,
  `utils`. A V2 should provide equivalent import ergonomics.

---

## 3. Application Bootstrap

Before rendering any route, the app performs a two-step initialization and shows a spinner
until both complete:

1. **CSRF cookie:** `GET /api/set-csrf-cookie`. The response must contain
   `{ detail: "CSRF cookie set" }`. On any failure the app retries from scratch. All
   subsequent mutating requests send the CSRF token (read from cookie) in the `X-CSRFToken`
   header. Requests send credentials (cookies).
2. **Current user:** `GET /api/user`. The result (`ApiUser` or anonymous user) is stored and
   provided to the app via context.

Only after CSRF is set **and** the user is fetched does the app mount the router. The
registration flow works for anonymous users; the admin flow requires an authenticated user
(see §6, §10).

---

## 4. Routing

Routing uses TanStack Router. Each route declares and validates its own search-param schema, so
admin selection state in the query string (`?registrationId`, `?camperId`, `?reportId`,
`?registrationsTab`, the record editors' `?regTab` and `?camperTab`, Lodging's `?lodgingView` and
`?lodgingFilter`,
Settings' `?settingsTab`, Email's `?emailTab`, `?templateId`, `?messageId` and history
filters, and
Template Help's `?context`, `?helpTab`, `?topic`, `?q`) is typed and
centrally defined. (Rationale: §15, DR-2.)

Search-param values are plain strings in the URL: `?reportId=71`, never a JSON-quoted
`?reportId=%2271%22`, and a value is read as the string it is (`71` is the string `"71"`, not a
number), so a typed or pasted link selects what it names. Empty values are left out. Links whose
values were written JSON-quoted still read the same (§15, DR-83).

The router defines two top-level branches. A trailing-slash normalizer redirects any URL
ending in `/` to the non-slash form.

### Public / registration routes (registration client store)

- `/` — splash/default page listing public events (open/closed status, and when registration
  closes, in the event's time zone), with a link to admin.
- `/events/:eventId/register` — redirects to `…/register/registration` (preserving query
  string, which may carry an invitation code).
- `/events/:eventId/register/registration` — Step 1, the registration form.
- `/events/:eventId/register/payment` — Step 2, payment.
- `/events/:eventId/register/finished` — Step 3, confirmation.
- `/invoices/:token` — an invoice's public pay page, reached by its unguessable link (§9.7;
  §15, DR-95). No sign-in.
- `/account/set-password/:uid/:token` — choose a password from an emailed set-password link
  (§6; §15, DR-52). Reached before signing in, so it isn't behind the admin guard.

The `eventId` is parsed from the URL by the registration API layer; the registration store's
queries derive it from `window.location` rather than props, through the routing library.

### Admin routes (behind auth guard)

- `/admin` and `/admin/organization/` — organization chooser.
- `/admin/organization/:organizationId/event` — event chooser for the org.
- **Users** (§8.10), for Admins only, opens over whatever admin page is showing, as search
  params on that page's URL: `?overlay=users` — Users is open; `?userId` — the user being
  edited: an id, or `new` for a new one; `?historyUserId` — the user whose change history is
  shown. For anyone else the overlay doesn't open. `/admin/users` (earlier links) redirects to
  `/admin` with the overlay open, keeping its `?userId` and `?historyUserId` (§15, DR-84).
- `/admin/organization/:organizationId/event/:eventId/*` — the Event Admin container, which
  hosts the admin sections (see §10). Unmatched admin subpaths redirect to `…/home`.
- `/admin/organization/:organizationId/event/:eventId/registrations` and `…/campers` — search
  params `?registrationsTab` (the Registrations section's tab), `?registrationId` / `?camperId`
  (the selected record), and `?regTab` / `?camperTab` — the open section of the record's editor
  (`attributes` by default, `admin`, `fees`, `campers` for a registration, `lodging` for a
  camper, `history`, `raw`).
- `/admin/organization/:organizationId/event/:eventId/lodging` — `?lodgingView`: `hierarchy`
  (default; the view labelled Layout) or `timeline` (labelled Assignments; §15, DR-74); `?camperId` and `?lodgingId` — the camper and the lodging node
  selected on the hierarchy, and `?timelineCamperId` and `?timelineLodgingId` — those selected on
  the timeline, whose details show beside that view only (§8.6; §15, DR-71); `?lodgingFilter` —
  the lodging nodes the timeline is narrowed to, as comma-separated ids (none: everything).
- `/admin/organization/:organizationId/event/:eventId/settings` — `?settingsTab`: the open
  settings section (`registration_types` by default, `validation_messages`, `email`, or the
  event field being edited, e.g. `camper_schema`).
- `/admin/organization/:organizationId/event/:eventId/email` — email (§8.9). Search params:
  `?emailTab` — `history`, `unsubscribed`, or templates (the default, left out of the URL);
  `?templateId` —
  the group email template being edited (`new` for a new one); `?messageId` — the email open in
  the history; `?mstatus`, `?mkind`,
  `?mq`, `?mpage`, `?mbatch` — the history's status and kind filters (comma-separated lists),
  search text, page, and the group email send whose copies it shows.
- `/admin/organization/:organizationId/event/:eventId/template-help` — Template Help (§9.3).
  Search params: `?context` — the kind of template (`report`, `confirmation_email`,
  `confirmation_page`, `invitation_email`, `invoice_email`, `bulk_email_registration`,
  `bulk_email_camper`, `bulk_email_manual`; default `report`); `?helpTab` — `variables` (default), `syntax` (filters, tests and tags),
  `markdown` or `guide`; `?topic` — the guide topic id; `?q` — the search text. Defaults are left out of the
  URL.

All admin routes are wrapped by a guard that fetches the current user and renders a login
form if the user is not authenticated; otherwise it renders the requested route. Heavy route
components are code-split/lazy-loaded with a spinner fallback.

---

## 5. State Management and API Contract

V2 **separates server-cache state from client state** (rationale: §15, DR-1):

- **Server state → TanStack Query (React Query).** All API reads and writes go through query
  and mutation hooks; caching, background refetch, and **query-key** invalidation (described
  below) handle freshness. Two logical API roots are used (admin: `baseUrl: /api`; public
  registration: `baseUrl: /api/events`); a single `QueryClient` can serve both.
- **Client state → Zustand.** The only genuine client state is the in-progress registration in
  the public flow (form data, computed totals, payment-step data, payment info,
  confirmation-step data, and an `updating` flag). A single small Zustand store holds it. The
  admin surface needs no global client store — component state and URL query params carry
  transient UI state.

Derived/augmented view models (AugmentedRegistration, AugmentedLodging — see below) are
**domain logic, not a state-library concern**: compute them with memoized selectors/hooks over
the cached query data, independent of the chosen libraries.

### REST conventions (admin API)

The admin API is a conventional REST API over Django. **Trailing slashes are required.**
Generate the standard hook set for each entity (e.g. a `createEntityHooks(name)` helper
producing `useList`/`useById`/`useCreate`/`useUpdate`/`useDelete`) so all entities behave
consistently:

- **List:** `GET /api/{entity}s/?<sorted query params>` → array. Query params are used for
  server-side filtering (e.g. `?event=<id>`, `?completed=1`, `?registration__event=<id>`).
- **Get by id:** `GET /api/{entity}s/{id}/` → object.
- **Create:** `POST /api/{entity}s/` (body without `id`/timestamps).
- **Update:** `PATCH /api/{entity}s/{id}/` (partial body).
- **Delete:** `DELETE /api/{entity}s/{id}/` → 204, or 409 `{ detail }` when something keeps it
  (§15, DR-54).
- **Delete preview:** `GET /api/{entity}s/{id}/delete-preview/` — what that delete would do,
  without doing it, for anyone allowed to delete it (403 otherwise). The delete itself follows
  the same plan, so the preview is exact at the time it's asked. **Every delete confirmation in the
  admin shows it** before offering the delete: what blocks it (no delete is offered), what goes
  with it, what's left behind but changed, and whether it can be restored; the delete waits for
  it, and only Cancel is offered if it can't be had.
  ```
  { can_delete: boolean,
    blocked_by: [{ detail, count, items: string[] }],   // why it can't be deleted
    deletes:    [{ type, name, count, items: string[] }],             // what goes with it
    changes:    [{ type, name, count, items: string[], description }], // what's left, changed
    restorable: boolean }
  ```
  `type` is the model (`camper`, `invitation`, …), `name` how to call `count` of them ("camper",
  "campers"), `items` up to 20 of their names (empty for email and audit records, which are only
  counted), and `description` what happens to them ("will be unassigned from their lodging",
  "stay in the email history"). `deletes` doesn't include the thing itself.
- **What a delete takes with it** (DR-54): deleting a lodging unassigns the campers in it or in
  anything under it (clearing their stay) and clears it from campers who asked for it; deleting a
  registration type leaves its registrations with no type, and deletes its invitations and its
  invitation email; deleting a deposit leaves its payments; a custom charge type campers still
  have, an organization with events, and an email account an event or sent email uses can't be
  deleted; only Admins delete events, and only before anyone has registered; only Admins delete
  payments and invoices, not a payment that has been refunded nor an invoice anything was paid on
  (§15, DR-93).
- **Soft delete** (registrations, campers, payments and promo codes; §15, DR-55, DR-67): `DELETE`
  marks one deleted (its `delete-preview` has `restorable: true`, and lists under `deletes` what
  goes out of sight with it: a registration's campers, invoices, payments and custom charges, a
  camper's charges; a promo code's lists under `changes` the registrations that keep it). A deleted
  one — and a deleted registration's campers, payments and charges — is gone from every list,
  detail (404), total, lodging count, report and recipient list, until it's restored. A deleted
  promo code is gone from the list and can't be applied, but registrations that have it keep it
  and its discount. Its `deleted_at` is read-only everywhere (set only by these endpoints).
  - `POST /api/{registrations|campers|payments|promocodes}/{id}/restore/` (Registrars and
    Admins) → 200 with the object; 409 `{ detail }` if it isn't deleted, for a camper or payment
    whose registration is deleted ("Restore the registration first."), or for a promo code
    whose code a live one of the event now uses. Restoring a registration brings back its
    campers and payments, except ones deleted on their own before it.
  - `GET /api/registrations/deleted/?event=`, `GET /api/campers/deleted/?event=`,
    `GET /api/promocodes/deleted/?event=` and
    `GET /api/payments/deleted/?event=|registration=` (Registrars and Admins; 400 without a
    filter) → the deleted ones, most recently deleted first, as the usual entity plus
    `deleted_at` and `deleted_by` (`{ id, username, name }`, or `null`); registrations also have
    `camper_count`. Campers and payments of a deleted registration aren't listed on their own —
    they come back with it.
  - `GET /api/{registrations|campers}/{id}/history/` works for a deleted one too.

Caching/invalidation uses query keys (one key namespace per entity, parameterized by the
filter params). Mutations invalidate the relevant entity key(s) so dependent lists refetch
automatically. Some mutations must invalidate **multiple** namespaces because they affect
derived data — e.g. updating a `Camper`, `CustomCharge`, `Payment` or `Invoice` must also
invalidate `Registration` queries (because totals/augmented data change), and a `Payment` and an
`Invoice` invalidate each other (an invoice's status comes from its payments).

Entities (each with the standard CRUD set unless noted): `Organization`, `Event`,
`Registration`, `RegistrationType`, `Report`, `Invitation`, `Lodging`, `Camper`, `Deposit`,
`Invoice` (no create, §9.7), `Payment`, `CustomCharge`, `CustomChargeType`, `PromoCode`, `EmailAccount`, `EmailTemplate`,
`EmailUnsubscribe` (no update), `User` (as ManagedUser, Admins only).

Non-CRUD admin endpoints:

- `GET /api/user` — current user (whoami): the Django user fields, plus `role` (the user's
  Camphoric permission group: `admin` | `registrar` | `reporter`, or `null` when signed out or
  without one; a superuser is always `admin`) and `must_change_password` (§6; §15, DR-50).
- `GET /api/version` — the release the server runs → `{ version: string | null }`: the version
  without the tag's `v` (`0.12.0`, `0.13.0-alpha.1`), or `null` when the server isn't a release
  build. Any role may read it (§8.1; §15, DR-98).
- **Roles on every admin endpoint (§6; §15, DR-50):** any role may read (including the POSTs that
  only read: the recipients preview, report render and template preview); Registrars and Admins
  may also write; organizations are written by Admins only. A signed-out caller gets 401, a
  signed-in one without the needed role 403, and user management (`/api/users/`) answers 404 to
  anyone who isn't an Admin.
- `POST /api/login` — `{ username, password }`, invalidates whoami.
- `POST /api/reports/{id}/render` — render a Jinja report → `{ report: string, error: string |
  null, diagnostics? }`. The body depends on the report's `variables_source` (§8.7): legacy
  (`client`) reports post the template-variable bundle; `server` reports post `{}`, render from
  the server's own variables, and add `diagnostics` (the `TemplateDiagnostic` list below);
  `report` is empty when there's an error.
- **Server-rendered templates** (§9.3, §9.6; all admin-only):
  - `GET /api/events/{id}/templates/describe` → the **variable spec** (§15, DR-36):
    `{ contexts, types, filters, tests, tags, globals }`. `contexts` maps each kind of template
    (`report`, `confirmation_email`, `confirmation_page`, `invitation_email`, `invoice_email`,
    `bulk_email_registration`, `bulk_email_camper`, `bulk_email_manual`) to `{ title, doc, roots, sample }`, where `roots`
    are its variables and `sample` names the kind of record a preview renders for
    (`registration` | `camper` | `invitation` | `invoice` | null). `types` maps a type name to
    `{ doc, fields, base?, builtin? }`. `builtin: true` marks a Python value type — `string`,
    `number`, `money`, `date`, `datetime`, `dict`, `list` — whose fields are a selection of
    that value's read-only methods; a `list<T>` has the methods of `list`. `base` names a type
    whose methods this one also has: `dict` for every Camphoric object and event-specific
    type (§15, DR-86). A field (and a root or global) is `{ name, type, doc, example?,
    nullable?, callable?, signature?, title?, identifier?, enum?, format? }`. `type` is
    `string`, `number`, `bool`, `money`, `date`, `datetime`, `dict`, `any`, `list<T>`, or a
    type name — including event-specific types built from the event's own forms and pricing
    (`attributes:camper`, `attributes:registration`, nested `attributes:camper.<key>`,
    `admin_attributes:*`, `attributes:payment`, `pricing:registration|camper|event`).
    `identifier: false` marks a key that must be written `['key']`; `callable` marks a method
    or function. Filters are `{ name, signature, doc, example, builtin }`, tests
    `{ name, doc, example }`, tags `{ name, doc, snippet }` (Monaco snippet syntax).
  - `POST /api/events/{id}/templates/preview` — renders **unsaved** text. Request:
    `{ context, template, output: 'csv' | 'md' | 'txt' | 'html' | 'email', subject?,
    registration_id?, camper_id?, invitation_id?, invoice_id?, registration_type_id? }`. Response:
    `{ output, subject?, html?, diagnostics, truncated, duration_ms, sample: { kind, id, label }
    | null }` (`html` is the `email` body rendered from markdown). Without a sample id, the first
    completed registration/camper/invitation/invoice is used. An unknown context or output, or a sample
    from another event, is a 400.
  - `GET /api/events/{id}/templates/check` → `{ ok, results: [{ kind, id, label, mode:
    'rendered' | 'parsed' | 'skipped', diagnostics }] }` — every saved template of the event,
    rendered (server reports), parsed only (legacy Jinja reports) or skipped (Handlebars).
  - **`TemplateDiagnostic`**: `{ severity: 'error' | 'warning', kind: 'syntax' | 'undefined' |
    'security' | 'timeout' | 'output_limit' | 'runtime', message, field, line, column }` —
    `field` is the text the problem is in (`template`, `subject`); `line`/`column` are 1-based
    or null.
- `POST /api/invitations/{id}/send` — queue an invitation email (send or resend) →
  `{ success: true, messageId, status }`. The server delivers queued email in the background
  (§15, DR-44) and sets the invitation's `sent_time` once it has been sent. If the registration
  type's invitation is written in Jinja and can't be rendered, nothing is queued and the response
  is a 400 `{ detail, diagnostics }` (the `TemplateDiagnostic`s below); an address that can't be
  emailed (invalid, or `@dontsend.com`) is a 400 `{ detail }`.
- `GET /api/customcharges/{camperId}` — custom charges for a camper.
- **Email history and accounts** (all admin-only; the outbox, §15, DR-44):
  - `GET /api/emailmessages/` — queued and sent email, newest first, 50 per page
    (`{ count, next, previous, results }`). Filters: `event`, `kind` / `kind__in`, `status` /
    `status__in` (comma-separated), `registration`, `invitation`, `account`, `batch`,
    `template`; `q` searches the recipient and subject. Each result is an `EmailMessage` without
    `text` / `html`.
  - `GET /api/emailmessages/{id}/` — one message, with the `text` and `html` that were sent.
  - `POST /api/emailmessages/{id}/retry/` — queue a `failed` message again → the message; 409
    `{ detail }` when it isn't failed or its address can't be emailed.
  - `POST /api/emailmessages/{id}/cancel/` — stop a `queued` message → the message; 409 when it
    isn't queued (it may already be sending).
  - `GET /api/events/{id}/email/queue` — what the event's email is doing now: `{ queued,
    sending, failed_last_day, next_attempt_at, worker: { required, alive, last_seen },
    account: null | { id, name, max_per_minute, max_per_day, sent_last_minute, sent_last_day,
    paused_until } }`. `paused_until` is set when a sending limit is used up (the account's mail
    waits until then); `worker.alive` is false when no worker has reported in for 2 minutes
    while `required`.
  - `POST /api/emailaccounts/{id}/test/` `{ to?, from_email? }` — queue a test message through
    the account (default `to`: the signed-in admin; default from: the account's username) →
    202 with the message. Deleting an account that an event or a message uses is a 409.
- **Group email** (all admin-only; §15, DR-45):
  - `GET /api/events/{id}/email/recipient-fields?source=registrations|campers` — the fields a
    group email's recipients can be chosen by: `[{ key, label, group, type, options? }]`, where
    `key` is a dotted path into the email's variables (`registration.balance`,
    `camper.attributes.meal_type`), `type` is `string` | `number` | `boolean` | `enum` | `date`
    | `list` (a multi-choice answer), and `options` (`[{ value, label }]`) lists an `enum`'s or
    `list`'s choices. Groups: Registration, Registration answers, Registration admin fields,
    Registration pricing, and for campers the same four for the camper.
  - `POST /api/events/{id}/email/recipients` — who an audience reaches, from a group template's
    fields, saved or not (`recipient_source`, `filter`, `filter_expression`,
    `address_expression`, `name_expression`, `recipient_list`, `include_incomplete`, and
    `template?`) → `{ recipients: [{ key, email, name, label, registration, camper,
    already_sent }], skipped: [{ label, reason, detail, email, registration, camper }],
    diagnostics }`. A recipient's `key` is `registration:<id>`, `camper:<id>` or
    `address:<email>`; `already_sent` is whether `template` has been sent to it. `skipped`
    reasons are `no_address`, `invalid`, `duplicate` (the same address, case-insensitively, as an
    earlier recipient), `filter_error` (an expression failed for it) and `unsubscribed` (the
    address unsubscribed from the event's group email); a bad rule or expression is a diagnostic
    on its field (`filter`, `filter_expression`, …).
  - `POST /api/emailtemplates/{id}/send/` `{ recipient_keys, account?, from_email?, reply_to?,
    skip_already_sent? (default true), send_at? }` — send a `group` template to the reviewed
    recipients, now or at `send_at` (ISO 8601; later needs the email worker) → 202 with the
    `EmailBatch`. A 400 `{ detail }` when no recipients are given or the template isn't a group
    email. The copies are rendered when the batch is prepared: a recipient no longer in the data
    is skipped as `gone`, one that has unsubscribed since as `unsubscribed`, one the template
    already reached as `already_sent` (unless `skip_already_sent` is false), and a copy that
    can't be rendered is a `failed` message. The send records where the site is reached from
    outside (`CAMPHORIC_PUBLIC_URL`, else the request's host) for the copies' unsubscribe links.
  - `POST /api/emailtemplates/{id}/test/` `{ to?, recipient_key?, subject?, body?, …audience }`
    — queue one copy, `[Test]` before the subject, rendered for `recipient_key` (else the first
    recipient), to `to` (default: the signed-in admin); unsaved `subject` / `body` / audience
    fields may be given → 202 `{ message, rendered_for, diagnostics }`; 400 `{ detail,
    diagnostics }` when it can't be rendered or there's no recipient.
  - `POST /api/emailtemplates/{id}/duplicate/` — a copy of a `group` template, named
    “… (copy)” → 201 with it.
  - `GET /api/emailbatches/?event=&template=&status=` — the event's sends, newest first; each an
    `EmailBatch`. `POST /api/emailbatches/{id}/cancel/` stops one — before it's prepared, or its
    copies still waiting (409 when already cancelled); `POST /api/emailbatches/{id}/retry-failed/`
    queues its failed copies again → the batch with `retried`.
  - `GET /api/emailunsubscribes/?event=` — the event's unsubscribed addresses, newest first;
    `POST` `{ event, email }` adds one as an organizer (the address is lowercased; 400 on `email`
    when it's already there); `DELETE /api/emailunsubscribes/{id}/` removes one.
- **Unsubscribe** (public, no login; §15, DR-48): `GET /api/unsubscribe/{token}/` is a page,
  rendered by the server, that asks to confirm unsubscribing the token's address from the
  token's event's group email (a GET changes nothing); `POST` to the same URL — the page's
  button, or a mail provider's one-click `List-Unsubscribe=One-Click` (RFC 8058) — records it
  and says so. The token is signed; a tampered one is a 400 page, an event that no longer exists
  a 404 page.
- **Users and passwords** (§6, §8.10; §15, DR-52):
  - `POST /api/users/{id}/send-password-link/` — email the user a set-password link → 202
    `{ to, status, last_error }` (never the link); 409 `{ detail }` for a deactivated user or no
    public address to link to.
  - `POST /api/users/{id}/password-link/` — a set-password link to hand over yourself →
    `{ url, expires_at }`.
  - `POST /api/users/{id}/set-password/` `{ password, require_change? (default true) }` —
    superusers only (404 for anyone else): set the password, ending the user's sessions → 204;
    400 `{ password: [...] }` when the password rules refuse it; 409 for your own account.
  - `POST /api/user/password` `{ current_password, new_password }` — change your own password
    (you stay signed in; it clears a must-change flag) → 204, or 400 keyed by field.
  - `POST /api/password-reset` `{ email }` (public) — always 202 `{ detail }` with the same
    message, whether or not the address has an account; emails a link to each active user with
    that address and a Camphoric permission group. Throttled per client address (429).
  - `GET /api/password-reset/{uid}/{token}` (public) → `{ username }` while the link works, 400
    `{ detail }` once it's used, expired or wrong. `POST` `{ new_password }` → 204 (or 400 keyed
    by field) sets the password and clears a must-change flag; it doesn't sign the user in.
  - While a user must change their password, every admin endpoint except whoami, logout and
    `POST /api/user/password` answers 403 `{ detail, code: 'password_change_required' }`.
- **Change history** (Registrars and Admins; 403 for Reporters; §15, DR-53):
  - `GET /api/registrations/{id}/history/` — the registration's changes and those of its campers,
    payments and custom charges, including ones since deleted; `GET /api/campers/{id}/history/` —
    the camper's and its custom charges'.
  - Each is an array, newest first, of `{ id, timestamp, request_id, actor, action, object,
    changes }`:
    - `actor` is `{ id, username, name }`, or `null` when no one was signed in (an online
      registration, a PayPal notification, the email worker); a user since deleted is
      `{ id: null, username: null, name }` with their email as `name`.
    - `action` is `'create' | 'update' | 'delete' | 'restore'`.
    - `object` is `{ type, id, label }`: `type` is the model (`registration`, `camper`,
      `payment`, `customcharge`), `label` what it was called at the time (a camper's name,
      "Check payment $100.00").
    - `changes` maps each changed field to `[old, new]`. JSON fields (`attributes`,
      `admin_attributes`, `stay`, the pricing results) come back as JSON; other values as text,
      with `null` for none. A create lists every field's first value, a delete its last.
    - `request_id` is the same for every entry one request caused, e.g. an edit and the pricing it
      recalculated.
  - `GET /api/users/{id}/history/?page=` (Admins only; 404 for everyone else; §15, DR-80) — what
    the user changed, in every event and organization, newest first: entries of the same shape,
    `object.type` any audited model (`event`, `report`, `lodging`, `user`, …), paginated 50 a
    page as `{ count, next, previous, results }`.
- `GET /api/eventlist` — public list of events for the splash page: `[{ name, url, open,
  registration_start, registration_end, time_zone }]`, the window as ISO instants (or `null`)
  and the event's time zone to show them in. Events whose registration closed more than 3
  months ago are left out.

### Registration API (public)

- `GET /api/events/{eventId}/register{?invitation/query}` → `ApiRegister` config bundle
  (schemas, ui schema, pricing logic, pricing vars, template vars, event subset, optional
  invitation/registration-type info, PayPal options, pre-submit template,
  `registrationErrorMessages` — the event's custom validation messages, `{}` when it has none;
  §7.1 — and `hasPromoCodes`, whether the event has a promo code a registrant could use now).
- `POST /api/events/{eventId}/checkpromo` with `{ code }` (anyone; throttled per client) → 200
  `{ code, label, scope, pricingLogic }` for a code of the event that's enabled, not expired and
  not deleted — matched without regard to case or surrounding space — or 400 `{ detail }`
  ("That promo code isn't valid for this event."), shown to the registrant (§7.1; §15, DR-67).
- `POST /api/events/{eventId}/register` with `{ step: 'registration', formData,
  pricingResults, invitation?, promoCode? }` → payment-step payload
  (`{ registrationUUID, serverPricingResults, paymentOptions, handlingPercent }`). The
  registration is *started*: saved, but not yet in the admin lists (§9.7). `paymentOptions` is
  `{ title, description, default, options: [{ name, title, amount, handling }] }`: the event's
  deposit choices worked out on the server against `serverPricingResults` (§15, DR-89) — each
  option's `amount` by check and the `handling` fee added when it's paid online — or a single
  "Full payment" option when the event has none. `handlingPercent` is the event's percent on
  online payments, or `null`. While the event isn't open (before
  `registration_start` or from `registration_end`), it's refused — 409 `{ detail: 'Registration
  for this event is closed.' }`, shown to the registrant — unless it carries a valid invitation
  for this event, so special registration types can still register. An invitation that isn't
  found, has been redeemed, has expired or is for another event is a 400 `{ detail }` saying
  which, shown to the registrant (the `GET` reports the same as `invitationError`). A
  non-blank `promoCode` the `checkpromo` check would refuse is a 400 with the same `{ detail }`
  and nothing is saved; a usable one is recorded on the registration and priced (§9.2). The code
  travels outside `formData`, so it's never one of the registration's `attributes`.
- `POST /api/events/{eventId}/register` with `{ step: 'paypal-order', registrationUUID,
  paymentOption, paymentType }` (`PayPal` | `Card`) — what the PayPal or card button calls
  (§7.2; §15, DR-90, DR-91). It **completes** the registration (unpaid until money arrives),
  makes or rewrites its registration invoice for the chosen option, and creates the PayPal order
  for it → `{ orderID, total, handling, invoice }`. The order has a single item, "Total for
  Invoice #{id} for {Event Name}", for the option's amount plus the handling fee; the fee isn't
  added to the invoice until the order is captured. 409 `{ detail }` if the event doesn't take
  payments online, or the registration invoice has already been paid on; 400 on
  `paymentOption` for an option that doesn't exist or asks for nothing.
- `POST /api/events/{eventId}/register` with `{ step: 'payment', registrationUUID,
  paymentType?, paymentOption?, paypalOrderId? }` → confirmation-step payload
  (`{ confirmationPage, serverPricingResults, invoice, ledger, emailError }`):
  - **By check** (`paymentType: 'Check'`, the default): completes the registration and makes or
    rewrites its registration invoice for `paymentOption` (the default option when left out),
    waiting for the check. A registration with nothing to pay is completed without an invoice.
  - **PayPal or card** (`paypalOrderId`): the server fetches the approved order, checks it's for
    this registration's invoice and for what the invoice asks now, and captures it — the money
    moves only here. Repeating it after a capture returns the same payload (the order is found
    captured), with no second payment or email. When it doesn't go through, the registration
    stays completed and unpaid, and the response is an error `{ detail, code, invoice }`:
    `amount_changed` (409: the invoice changed since the order was made; nothing was captured),
    `declined` (402: PayPal refused; nothing was captured), or `unknown` (502: PayPal's answer
    was lost, so money may have moved — the order is kept pending on the invoice, the event is
    emailed the details, and the confirmation is sent).
  - `confirmationPage` is the event's confirmation page already rendered on the server, as
    markdown (§7.3); `invoice` is the registration invoice (or `null`) and `ledger` the
    registration's `{ price, handling_charges, total_owed, total_paid, balance,
    uninvoiced_balance }` (§9.7). The confirmation email is queued, not sent, before the
    response (§15, DR-44): `emailError` is true only when it couldn't be queued.
  - The option and method can change until something is paid on the registration invoice;
    after that, repeating the step returns the same payload and changes nothing. The payment
    step isn't limited by the registration dates: a registration accepted before closing can
    still pay.
  - A request in the old shape (with `paymentData` or `payPalResponse`) is refused with a 409
    asking the registrant to reload the page.
- `POST /api/events/{eventId}/register` with `{ step: 'finish', registrationUUID }` — finish
  without paying now, after a PayPal attempt that didn't go through: sends the confirmation
  (once) and returns the confirmation-step payload. 409 for a registration not yet completed.

> **Server is authoritative.** The client sends its locally computed `pricingResults`, but the
> server recomputes and returns `serverPricingResults`, which the client uses thereafter. Every
> amount on the payment step — each option's amount and handling fee, and what PayPal is asked
> to capture — comes from the server; the client never computes one (§15, DR-89, DR-90).

### Invoice pay API (public)

An invoice's pay page (§9.7; §15, DR-95) works from its link code (`token`), with no sign-in.
Anyone may call these; they're throttled per client (scope `invoice_pay`), and a code that isn't
an invoice of a completed registration is a 404.

- `GET /api/invoices/pay/{token}` → `ApiInvoicePay`: `{ event: { id, name }, invoice: { id,
  description, memo, due_on, amount, handling, total, amount_paid, amount_due, status, pending },
  campers, online }`. Money fields of `invoice` are decimal strings; `pending` says a PayPal order
  on it hasn't been confirmed. `campers` are the registration's campers as first name and last
  initial ("Pat A."). It never carries the invoice's `notes`, the registrant's email or other
  registration details. `online` is `{ clientId, handling, total, handlingPercent }` — the
  PayPal client id, the handling fee paying online adds (0 when the invoice already carries one),
  the total PayPal would be asked for, and the event's percent — or `null` when it can't be paid
  online: nothing is due, it's cancelled, or the event doesn't take payments online.
- `POST /api/invoices/pay/{token}/order` with `{ paymentType }` (`PayPal` | `Card`) →
  `{ orderID, …ApiInvoicePay }`: the server creates the PayPal order for the amount due plus the
  fee, as on the registration's payment step (§15, DR-90). 409 `{ detail, code: 'not_payable',
  …ApiInvoicePay }` when nothing is due or it's cancelled; 400 on `paymentType` for any other
  type.
- `POST /api/invoices/pay/{token}/capture` with `{ orderID, paymentType }` → `ApiInvoicePay`
  after the server has checked and captured the order (the payment's notes say "Paid online").
  When it doesn't go through, the response is `{ detail, code, …ApiInvoicePay }` with the
  registration payment step's codes and statuses — `amount_changed` (409), `declined` (402),
  `unknown` (502; the order stays pending and the event is emailed), and `mismatch` (400: the
  order isn't this invoice's).

### Data model (entity shapes the client relies on)

These are the fields the client reads/writes. They must stay in sync with the backend
serializers. Define them as **explicit, `export`ed TypeScript types in a dedicated module**
(e.g. `api-types.ts`) that callers import — **not** as ambient `declare global` interfaces like
the current `global.d.ts` (which pollutes the global namespace and hides where types come from).
Until the types are generated from the backend (see below), they remain hand-maintained, so any
serializer change must be mirrored here. (Rationale: §15, DR-27.)

> **Future (needs a backend change, tracked in `TODO.md`):** auto-generate these types from a
> backend OpenAPI schema (`drf-spectacular`) via `openapi-typescript`, run in CI, so they can't
> drift. Deferred from V1 because it touches `server/`.

- **Organization:** `id`, `name`, timestamps. Any role lists them; only Admins create, rename
  (`name` must not be blank) and delete them. Deleting one that still has events is a 409
  `{ detail }` (§15, DR-50).
- **ManagedUser** (`/api/users/`, Admins only — 404 for everyone else; §15, DR-50, DR-52): `id`,
  `username`, `email` (required; unique regardless of case), `first_name`, `last_name`, `role`
  (the Camphoric permission group: `admin` | `registrar` | `reporter`, or `null` for no access;
  a superuser's is always `admin`), `django_access` (`regular` | `staff` | `superuser`; present
  in responses to superusers only, and only they may change it — others' values are ignored),
  `is_active`, and read-only `last_login`, `date_joined`, `has_password`. Creating takes `role`
  (required) and `send_password_link` (default `true`: email a set-password link); a superuser
  may instead give `password` and `require_change` (default `true`). `is_staff`,
  `is_superuser`, groups and permissions can't be written. Nobody may change their own `role`
  or `django_access`, deactivate or delete themselves (409 `{ detail }`); a superuser's `role`
  can't change while they're a superuser (400). Deactivating ends the user's sessions and API
  tokens.
- **Event:** `id`, `name`; `registration_start`/`registration_end` (the registration window:
  ISO instants, which the server answers in UTC, `…Z`, or `null` when unbounded; registration is
  open from the start, inclusive, until the end; a value written without a UTC offset is refused
  with a 400 rather than read as UTC); `time_zone` (the camp's IANA time zone, e.g.
  `America/Los_Angeles`, which the window is entered and shown in; a new event gets the server's
  template time zone; an unknown zone is refused with a 400; §15, DR-97); `start`/`end` (event
  dates, `YYYY-MM-DD`, or `null`); `default_stay_length`; JSON Schemas: `camper_schema`, `camper_admin_schema`,
  `registration_schema`, `registration_ui_schema`, `registration_admin_schema`,
  `payment_schema`, `deposit_schema`; `pricing` (named numeric vars);
  `camper_pricing_logic` / `registration_pricing_logic` (JSON Logic component lists, each
  `[{ var, label?, exp }]` with a component whose `var` is `total`; saving one without is
  refused with a 400 `{ <field>: ['message'] }`, §15, DR-69);
  `registration_template_vars`; `registration_error_messages` (custom validation messages,
  `{ field path: { validation keyword: Handlebars message } }`, §7.1);
  `confirmation_page_template` (a Jinja markdown template, §7.3; saving one that doesn't parse
  is refused with a 400 `{ confirmation_page_template: ['Line N: message'] }`);
  `confirmation_template` (read-only: the id of the confirmation email's `EmailTemplate`, created
  with the event, §8.3), `invoice_template` (read-only: the id of the invoice email's
  `EmailTemplate`, likewise; §8.3, §15, DR-96) and `confirmation_email_from` (the event's
  sending address);
  `paypal_enabled`, `paypal_client_id`, `epayment_handling` (percent); `organization`.
- **Registration:** `id`, `attributes` (registrant form data), `admin_attributes`,
  `registrant_email`, `server_pricing_results`, `client_reported_pricing`, `event`,
  `registration_type`, `promo_code` (the id of its promo code, or null), read-only `promo`
  (`{ id, code, label, scope, deleted }` of that code, or null — present even once the code is
  deleted, to label its discount), `uuid`, `completed` (a payment button was pressed; §15,
  DR-91), read-only `completed_at` and `confirmation_sent_at`, timestamps; and its ledger
  (§9.7), read-only numbers: `total_owed` (the price plus the handling fees on its invoices),
  `total_paid` (its payments less refunds), `balance` (`total_owed − total_paid`; negative when
  a refund is due), `handling_charges`, and `uninvoiced_balance` (the balance no open invoice asks
  for yet, never below 0). A Registrar or Admin may set `promo_code` to any live code of the
  registration's event, usable by registrants or not, or clear it (400 on `promo_code`
  otherwise); a deleted code the registration already has may be sent back unchanged. Changing
  it reprices the registration. How the registrant chose to pay lives on its registration
  invoice, not on the registration (§15, DR-87).
- **Camper:** `id`, `attributes`, `admin_attributes`, `registration`, `lodging` (assigned),
  `lodging_requested`, `lodging_shared`/`lodging_shared_with`/`lodging_comments`,
  `server_pricing_results`, `sequence` (order within a registration), `stay` (array of ISO
  date strings the camper is present), timestamps.
- **Report:** `id`, `event`, `title`, `output` (`csv` | `md` | `txt` | `html` | `hbs`),
  `template`, `variables_schema`, `variables_source` (`client` | `server`; the API defaults to
  `server` (§15, DR-40), and `hbs` requires `client`), timestamps.
- **RegistrationType:** `id`, `event`, `name` (machine), `label`, `invitation_template`
  (read-only: the id of its invitation email's `EmailTemplate`, created with the type, §8.4).
- **EmailTemplate** (`/api/emailtemplates/`, filter `event`, `purpose`; §15, DR-45): `id`,
  `event`, `purpose` (`confirmation` | `invoice` | `invitation` | `group`), `name`, `subject` and `body`
  (Jinja; the body is markdown), `from_email` (blank: the event's `confirmation_email_from`),
  `reply_to` (blank: the sending account's default), `account` (null: the event's account),
  timestamps. Saving one whose subject or body doesn't parse is refused with a 400
  `{ subject | body: ['Line N: message'] }`. Only `group` templates can be created or deleted
  (the confirmation, the invoice email and invitations come with their event and types; deleting
  one is a 409), and a
  template's `purpose` and `event` can't change. A `group` template also has its default
  audience: `recipient_source` (`registrations` | `campers` | `manual`), `filter` (rules,
  `{ combinator: 'and' | 'or', rules: [{ field, op, value }] }` with `field` a recipient-fields
  `key` and `op` by type — string: `contains`, `not_contains`, `is`, `is_not`, `is_set`,
  `is_not_set`; number: `eq`, `ne`, `gt`, `lt`, `gte`, `lte`, `is_set`, `is_not_set`; boolean:
  `is_true`, `is_false`; enum: `is`, `is_not`, `any_of` (value: a list), `is_set`,
  `is_not_set`; date: `before`, `after`, `on`, `is_set`, `is_not_set`; list: `contains`,
  `any_of`, `is_set`, `is_not_set`), `filter_expression` (Jinja; it and the rules must both
  pass), `address_expression`, `name_expression`, `recipient_list` (for `manual`: one
  `email` or `Name <email>` per line) and `include_incomplete`; saving one with a malformed rule
  or an expression that doesn't parse is a 400 on that field.
- **EmailBatch** (§15, DR-45): `id`, `event`, `template` (null once the template is deleted),
  `name`, `subject`, `body` (a snapshot of what was sent), `recipient_source`,
  `recipient_keys` (the reviewed recipients), `account`, `from_email`, `reply_to`,
  `skip_already_sent`, `send_at`, `status` (`scheduled` | `expanding` | `sending` |
  `cancelled`), `skipped` (`[{ key, label, reason }]`, from preparing it), `error`,
  `created_by`, `created_by_name`, timestamps, and read-only counts `total`, `sent`, `failed`,
  `cancelled`, `waiting`, and `state` (`scheduled` | `preparing` | `sending` | `done` |
  `cancelled`; `done` is sending with nothing waiting); `link_base` is where the site was reached
  from when it was sent, for the unsubscribe links.
- **EmailUnsubscribe** (`/api/emailunsubscribes/`, filter `event`; §15, DR-48): `id`, `event`,
  `email` (lowercased), read-only `source` (`link` | `admin`), `created_by`, `created_by_name`
  and `created_at`.
- **Invitation:** `id`, `registration?`, `registration_type?`, `invitation_code`,
  `recipient_name`, `recipient_email`, `sent_time?`, `expiration_time?`, and read-only `email`:
  the latest invitation email's delivery, `null | { id, status, error, queued_at, sent_at }`,
  and `registration_deleted` — its registration has been deleted (the invitation still counts
  as redeemed; §15, DR-55), and `register_link` — the registration page with this invitation's
  email and code (from `CAMPHORIC_PUBLIC_URL`, else the request; `''` for an invitation with no
  type).
- **EmailAccount:** `id`, `organization`, `name`, `backend`, `host`, `port`, `security`
  (`starttls` | `ssl` | `none`), `timeout`, `username`, `max_per_minute?`, `max_per_day?`,
  `default_reply_to`, and `password`, which is write-only (stored encrypted; blank on an update
  keeps it); read-only `password_status` is `set` | `unset` | `unreadable` (the encryption key
  changed, so it must be entered again).
- **EmailMessage:** `id`, `event?`, `kind` (`confirmation` | `confirmation_report` |
  `page_report` | `payment_report` | `invitation` | `invoice` | `bulk` | `test`), `registration?`, `invitation?`, `account?`,
  `account_name?`, `from_email`, `to`, `reply_to`, `subject`, `text`, `html`, `status`
  (`queued` | `sending` | `sent` | `failed` | `cancelled`), `attempts`, `next_attempt_at`,
  `last_error`, `sent_at?`, `smtp_message_id`, `created_by?`, `created_by_name?`, timestamps.
- **Lodging:** `id`, `event`, `parent`, `name`, `children_title`, `capacity`, `reserved`,
  `visible`, `sharing_multiplier`, `notes`.
- **Deposit:** `id`, `event`, `deposited_on`, `attributes`, `amount`.
- **Invoice** (`/api/invoices/`, filter `registration`, `registration__event`,
  `registration__completed`; §9.7, §15, DR-87): a request for one chunk of a registration's
  balance. `id`, `registration`, `origin` (`registration` | `payment_received` | `admin` |
  `migrated`, §9.7), `description`, `amount` (toward the registration), `handling` (the
  e-payment handling fee on it; adds to what's owed), `payment_type` (how the payer chose to pay
  it), `due_on`, `memo` (shown to the payer), `notes` (internal), read-only
  `pending_paypal_order_id`, `cancelled_at`, `cancel_reason`, `created_by`, `created_by_name`,
  timestamps; and, worked out from its live payments, read-only `total` (`amount + handling`),
  `amount_paid` (net of refunds), `amount_due`, `overpaid`, `status` (`open` |
  `partially_paid` | `paid` | `overpaid` | `cancelled`) and `payments` (ids); and read-only
  `pay_url`, the invoice's public pay page (§9.7; §15, DR-95) — from `CAMPHORIC_PUBLIC_URL`, else
  the request. Its link code itself isn't a field. Money fields are decimal strings. Any role
  reads, notes included; Registrars and Admins edit `description`, `amount`, `handling`, `memo`,
  `notes` and `due_on` (neither amount may be negative). An invoice stays on its registration
  (400 on `registration` for a change).
  - `POST /api/invoices/` (Registrars and Admins; §15, DR-96) `{ registration, description,
    amount, handling?, memo?, notes?, due_on? }` → 201 with the invoice, origin `admin` and
    `created_by` the user. (The payment step and recording payments make the others.)
  - `POST /api/registrations/{id}/invoice-balance/` (Registrars and Admins) `{ description?,
    memo?, notes?, due_on? }` → 201 with an `admin` invoice for the registration's
    `uninvoiced_balance` (description "Registration balance" unless given); 409 `{ detail }` when
    no balance is left to invoice.
  - `POST /api/invoices/{id}/send/` (Registrars and Admins) → `{ messageId, status, to }`: queues
    the event's invoice email (§8.3) for this invoice to the registrant's email (kind `invoice`).
    A cancelled invoice is a 409 `{ detail }`; when the email can't be rendered, nothing is
    queued and it's a 400 `{ detail, diagnostics }`; an address that can't be emailed is a 400
    `{ detail }`.
  - `POST /api/invoices/{id}/cancel/` `{ reason }` and `/reopen/` (Registrars and Admins) → the
    invoice. Cancelling one that still holds money (its payments don't net to 0) is a 409
    `{ detail }`; a cancelled invoice charges no handling.
  - `POST /api/invoices/{id}/check-paypal/` (Registrars and Admins): asks PayPal about the
    invoice's pending order → `{ result: 'recorded' | 'not_captured', payment, invoice }`: a
    captured order is recorded as a payment (once), one never captured is cleared.
  - `DELETE` (Admins only; §15, DR-93): only an invoice nothing was ever paid on (deleted payments
    count) — a 409 otherwise; a hard delete.
- **Payment:** `id`, `registration`, `invoice` (every payment belongs to one; §15, DR-87),
  `deposit?` (a bank deposit), `payment_type`, `paid_on`, `attributes`, `amount` (negative for a
  refund; §15, DR-94), `notes`, `refund_of` (for a refund: the payment it gives money back
  from), read-only `paypal_response` (PayPal's reply) and `paypal_transaction_id` (PayPal's
  capture id, or refund id — unique, so one PayPal transaction is recorded once), `refunded`
  (how much of a payment has been refunded) and `paypal_refundable`; write-only `new_invoice`.
  Recording one (Registrars and Admins) without `invoice` puts it on the registration's oldest
  invoice with money due, or — with none, or `new_invoice` — on a new `payment_received` invoice
  for exactly it (§9.7). A refund names `refund_of` (its invoice is that payment's) or at least
  `invoice`, and can't give back more than is left of the payment (400 otherwise). A payment
  can't go on another registration's invoice or a cancelled one. Only Admins delete a payment
  (§15, DR-93), and not one that has been refunded (409); restoring stays with Registrars and
  Admins.
  - `POST /api/payments/{id}/refund-paypal/` `{ amount, reason, request_id }` (Registrars and
    Admins): refunds some or all of a PayPal or card payment through PayPal and records the
    refund → 201 with the refund payment. `request_id` is made once per refund attempt, so a
    retry refunds once. 409 `{ detail, code: 'refused' }` when it can't (not a PayPal payment,
    more than is left, or PayPal refused); 502 `{ code: 'unknown' }` when PayPal's answer was
    lost (nothing is recorded, and the event is emailed the details).
- **CustomCharge / CustomChargeType:** charge has `camper`, `custom_charge_type`, `amount`,
  `notes`; type has `event`, `name`, `label`.
- **PromoCode** (`/api/promocodes/`, filter `event`; soft-deleted; §15, DR-67): `id`, `event`,
  `label` (names the discount's price line), `code` (what the registrant enters; stored trimmed,
  not blank, and unique among the event's live codes regardless of case — a 400 on `code`
  otherwise), `pricing_logic` (one JsonLogic expression for the discount, a positive amount),
  `scope` (`registration` | `camper`: worked out once, or for each camper; §9.2), `enabled`,
  `expiration_date` (ISO datetime or null; registrants can't use the code after it), timestamps.
  Any role reads; Registrars and Admins write.
- **PricingOverride** (`/api/pricingoverrides/`, filter `registration`, `camper`,
  `registration__event`; §15, DR-56): a registrar's amount for one price line, in place of what
  the pricing logic computes. `id`, `registration`, `camper` (null for a line of the
  registration itself), `var` (the line), `amount`, `reason`, read-only `created_by`,
  `created_by_name`, `applied` (whether it's in effect: the event's pricing still has that
  line), timestamps. Any role reads; Registrars and Admins write. Rules (a 400 on `var`
  otherwise):
  - `var` is one of the event's camper pricing lines (for a camper) or registration pricing
    lines (for the registration); never `total`, which is always the sum. The e-payment
    handling fee isn't a price line: it's edited on its invoice (§9.7; §15, DR-88).
  - One per line; `reason` can't be blank. A camper's override takes its registration from the
    camper.
  - It applies right after its line is worked out, so everything after it — the totals, a
    deposit — follows.
  - The pricing results record the amounts overrides replaced as `overridden`
    (`{ var: computed }`, on the registration's results and each camper's). It's for the admin:
    templates, emails and the registrant never see it, only the new amounts.
- **User** (whoami): `id`, `username`, `email`, `first_name`, `last_name`, `is_staff`,
  `is_superuser`, `is_active`, `last_login`, `date_joined`, `role` and `must_change_password`; an
  anonymous user has `username: ''`, `id: null` and `role: null`.

The client also derives **augmented** view models that a V2 should reproduce (in selectors or
hooks):

- **AugmentedRegistration** = registration + `campers[]` (its campers) + resolved
  `registrationType` + `total_payments` and `total_balance` (the server's `total_paid` and
  `balance`, under the names older Handlebars reports use; `total_owed` is the server's too,
  §9.7).
- **AugmentedLodging** = lodging + `children[]` (nested) + `isLeaf` + `campers[]` (assigned
  here) + `count` (campers in subtree) + `capacity` (explicit, or sum of children) +
  `maxCapacity` + `fullPath` (e.g. `Building A→Room 101`) + `pathParts`.

---

## 6. Authentication

- The admin guard requires a non-empty `username` on the current user. Anonymous users see a
  **Login** form (username/password) that posts to `/api/login`; on success the whoami cache
  is invalidated and the guarded content renders.
- The registration flow needs no authentication, but an **invitation code** in the query
  string grants access to otherwise-closed registration and pre-fills invitation context. The
  server enforces this too: outside the registration dates, only a submission carrying a valid
  invitation for the event is accepted (§5).
- A **logout** action (`POST /api/logout`) clears the session. A global handler bounces a 401 on
  any admin endpoint back to the login form, preserving the attempted URL; a 401/403 on a
  registration submit surfaces a friendly error (see §15, DR-9).
- **Roles.** Every admin user has one site-wide **Camphoric permission group** (§15, DR-50):
  - **Admin** — everything, including users and organizations. A superuser is always an Admin.
  - **Registrar** — everything except users and organizations.
  - **Reporter** — read-only: they can open every section, render and download reports, and use
    previews, Template Help and recipient previews, but can't create, edit, delete or send
    anything (test emails, invitations, retries and cancels included), and don't see change
    histories or deleted items (§15, DR-53, DR-55).

  The server enforces the roles (§5). A signed-in user without a group sees a **no-access**
  screen (who they're signed in as, that an administrator must give them a group, and Sign out)
  instead of the admin. For a Reporter the admin is **read-only** (§15, DR-51): controls that
  create, change, delete or send are hidden, forms and editors are shown but can't be changed,
  and dragging on the lodging timeline is off; records still open for reading, a template opens
  to read, and previews, renders and recipient review work. The signed-in user's name and group
  are always visible, with Sign out, Change password, and — for Admins — Users (§8.1, §8.2,
  §8.10). A 403 the admin didn't prevent is reported as "You don't have permission to do that."
  (§10).
- **Passwords** (§15, DR-52): anyone can ask for a link to choose a new password from the sign-in
  form; new users get one by email; signed-in users can change their own; and a superuser can set
  someone's password, requiring them to change it before they can do anything else (§8.10).
- **Proactive session monitoring (admin).** Rather than waiting for a request to fail, the admin
  surface checks session validity (against the lightweight whoami endpoint, `GET /api/user`) on
  window **focus**, on **user activity** (throttled), and on a **regular interval**, and treats
  that traffic as keep-alive so an active admin's session is refreshed and doesn't lapse
  mid-work. If a check finds the session has expired, the admin is **immediately presented with
  an in-place way to re-authenticate** (e.g. a login prompt over the current screen); on success
  they continue exactly where they were, preserving any in-progress edits, without a full reload
  or navigation. The reactive 401 handling above remains the backstop. The public registration
  flow is anonymous and unaffected. This relies on backend session keep-alive config (see §15,
  DR-26, and Appendix A).

---

## 7. Registration Flow (Public)

The registration client store (Zustand; see §5) holds: `registration` (form data, initialized
to `{ campers: [{}] }`), `totals` (PricingResults), optional `paymentStep`,
`confirmationStep`, and an `updating` flag.

Before any step renders, the app loads the registration config (`GET …/register`) and:
- indicates loading while it fetches;
- if the event is not currently open **and** there's no invitation, presents a
  registration-closed message;
- otherwise sets the document title, surfaces invitation context when an invitation/type is
  present (and any invitation error), then shows the current step.

### 7.1 Step 1 — Registration form

- Renders a JSON Schema Form from `config.dataSchema` + `config.uiSchema` with the in-progress
  `registration` as form data. A field whose uiSchema gives it the class
  `camphoric-hide-during-registration` (`"ui:classNames"`) is hidden here but shown in the admin's
  forms — e.g. a parking pass's type, which the organizers assign.
- **Live updating:** on every change it (a) marks `updating`, (b) saves form data to the
  store, (c) recomputes totals via `calculatePrice` (§9) and stores them, (d) persists form
  data to localStorage (debounced). The running price total is shown and updates live as the
  form changes, with a progress indication while it recalculates.
- **Local persistence:** form data is saved to localStorage under a key derived from the
  schema title and the event start date. On mount the step rehydrates from localStorage (if
  present) and recomputes the price. After successful submission/confirmation the stored data
  is cleared (unless a `KEEP_REG_DATA` localStorage flag is set, used for debugging).
- **Validation:** switches to live validation after the first failed submit. On error it
  surfaces the validation problems prominently — in a list at the top of the form and under
  each affected field — and takes the registrant to the first problem: the first field *on the
  page* with a visible error is focused and scrolled into view (for a composite field such as
  the lodging picker, its control marked invalid). The browser's own required-field check runs
  first and behaves the same way for empty required inputs.
- **Validation messages:** every validation error is shown in plain language, using the event's
  own message where it has one (`registrationErrorMessages`, edited in Settings, §8.8; §15,
  DR-34):
  - **Contract.** The messages are a map of *field path* → *validation keyword* → *message*.
    The path is the error's location with array positions written as `*`
    (`campers.*.lodging.lodging_requested.id`); the path `*` holds event-wide defaults per
    keyword. Keywords are ajv's (`required`, `pattern`, `format`, `enum`, `minLength`, …);
    `dependencies` errors count as `required`.
  - **Lookup order:** the field's own message → the event's `*` default for that keyword → the
    app's built-in message (e.g. "This field is required") → the validator's own message.
  - **Messages are Handlebars templates** rendered as plain text, with `{{camper}}` (e.g.
    "2nd camper (Child Miles)"), `{{camperNumber}}` (1-based), `{{field}}` (the field's label)
    and `{{params.*}}` (the error's parameters, such as `limit` or `pattern`). A message that
    fails to render falls back to the built-in one; it never breaks the form.
  - **Placement.** The message appears under the field; the list at the top adds the camper
    and field ("2nd camper (Child Miles) – Lodging: …") unless the message already names them.
    Custom fields show their errors too — the lodging picker marks an unfinished choice (e.g.
    "RV Camping" without an RV length) under its last dropdown.
  - **Noise.** When a conditional branch fails, the validator also reports summary errors
    ("must match exactly one schema") beside the real one; those are hidden, and exact
    duplicates are shown once. Hidden errors still block submission.
- **Pre-submit content:** before the registrant proceeds, optionally show an electronic-payment
  handling-charge notice — the event's `epayment_handling` percent, added to what's paid online,
  when the event takes payments online (no amount: the fee is worked out on what's paid; §15,
  DR-88) — and the server-provided `preSubmitTemplate` (rendered through the template engine).
  An action advances the registrant to payment.
- **Promo code** (§15, DR-67): when the config's `hasPromoCodes` is true, the registrant can
  enter a promo code just before advancing to payment. Applying it checks it with
  `checkpromo`: a usable code is shown as applied (with its label), kept in the registration
  store and priced live (§9.2); a refused one shows the server's message by the field. An
  applied code stays applied only while the field still holds it, and can be removed. A code
  that has been typed but not applied blocks advancing, with a message by the field, until it's
  applied or cleared. Pressing Enter in the field applies the code; it doesn't submit the form.
- **Submit:** posts `{ step: 'registration', formData, pricingResults, invitation?, promoCode? }`
  (`promoCode` only when one is applied). On success it stores the returned payment-step payload
  in the store and advances to the payment step. It also saves the *sent registration* in
  localStorage beside the form data: the payment-step payload together with the form data and
  applied promo code exactly as they were sent.
- **Already sent:** when this browser has a saved payment step for the event (the form was sent,
  and the registrant hasn't reached the confirmation), the step says so and offers to continue
  to payment for that registration, or to start a new one (which clears what's saved). A reload
  of the payment step resumes from what's saved the same way, so leaving PayPal's window or
  closing the tab doesn't lead to a second registration from the same browser. Resuming restores
  the payment step, the form data and the promo code that were sent, so the payment step's
  review shows what was entered — not edits made to the form afterward, which weren't sent.

### 7.2 Step 2 — Payment

**Review registration.** Before the payment options, the step presents a read-only rundown of
everything entered in step 1 (§15, DR-33): the registration's own fields, then one section per
camper. Values are shown in human-readable form derived from the form schema and uiSchema —
field titles as labels, `enumNames`/`oneOf` titles instead of raw enum values, booleans as
Yes/No, multi-choice arrays joined, nested objects (address, emergency contact, lodging) as
indented groups, a requested lodging by its name — following `ui:order`, skipping hidden widgets
and empty values, and resolving conditional fields (`$ref`, `dependencies`, `if/then`) against
the entered data so the review lists exactly the fields the form showed. Each section ends with
its share of `serverPricingResults`: the registration section lists the registration-level
pricing components (plus the promo code's discount) and the grand total — the e-payment
handling fee isn't part of the price; the payment options show it (§9.7); each camper section
lists that camper's components (with a per-camper promo discount) and its total. The discount is labelled with the applied code's label.
Components that come to exactly $0 are left out; negative ones (discounts, credits) are listed,
and the totals are always shown, even at $0 (§15, DR-33). Labels come from the pricing logic's
`label`s (§11).

Then reads the payment-step payload's `serverPricingResults.total`:

- **No payment needed** (total ≤ 0): an action completes the registration without collecting
  payment (posts `{ step: 'payment', registrationUUID }`; no invoice is made).
- **Payment needed** (total > 0): the registrant chooses a payment option and how to pay
  (§9.7). Every amount comes from the server (§15, DR-89, DR-90):
  - **Payment options:** the payload's `paymentOptions` (the event's deposit choices — "Full
    Payment", "50% Deposit" …) with its title and description; the default is pre-chosen. For
    the chosen option the step shows what paying by check costs (its `amount`) and, when the
    event takes payments online, what paying online costs (`amount + handling`, naming the fee).
    With a single option there's nothing to choose.
  - **Pay by check:** posts `{ step: 'payment', registrationUUID, paymentType: 'Check',
    paymentOption }`. The server completes the registration and makes its invoice, which waits
    for the check.
  - **PayPal / credit card:** PayPal's buttons (its account button, and its own Debit or Credit
    Card button, which stays enabled; any guidance shown with the buttons matches the buttons
    PayPal shows — §15, DR-77). Pressing one posts `{ step: 'paypal-order', registrationUUID,
    paymentOption, paymentType }` (`Card` or `PayPal`, from the button clicked); the server
    completes the registration and creates the PayPal order, whose id goes to PayPal's
    checkout. On the payer's approval the step posts `{ step: 'payment', registrationUUID,
    paymentType, paypalOrderId }` and the server captures it. The browser never creates or
    captures an order (§15, DR-90). While PayPal's script loads, the buttons' place shows that
    it's loading; if it can't load (PayPal refuses the event's client id, a blocker stops it,
    PayPal is down), the registrant is told online payment isn't available and to reload or
    contact the organizers — never left with no buttons and no reason.
  - **When a PayPal payment doesn't go through** — the payer closes PayPal's window, PayPal
    declines, or the amount changed — the registrant is told they're registered, that the
    option's amount is still due, and why (the server's message) when there is one. They can
    try again (perhaps with another option), pay by check, or **finish and pay later** (posts
    `{ step: 'finish', registrationUUID }`), which sends the confirmation and shows the
    confirmation page (§15, DR-91).
  - **When PayPal's answer was lost** (the `unknown` code): money may have moved, so the
    registrant is asked not to pay again — the organizers will check — and offered only to
    finish; the payment options and buttons aren't shown.
  - While a payment is in flight, block further interaction and indicate progress (and prevent
    double submission). For PayPal, the payment is in flight from the payer's approval, not
    while PayPal's own checkout (its popup or its inline card form) is open. Cancelling PayPal's
    checkout, an SDK error, or a failed capture releases the block; an error also tells the
    registrant that the payment didn't go through (§15, DR-77).
- On success the step stores the confirmation-step payload and navigates to the confirmation
  step. If the payment step data is missing and none is saved, it redirects back to step 1.

### 7.3 Step 3 — Confirmation

- Shows the confirmation page the server rendered for this registration
  (`confirmationStep.confirmationPage`, markdown), through the sanitizing markdown pipeline
  (§9.3). The client does no templating here (§15, DR-42).
- The page is the event's `confirmation_page_template`, a Jinja template rendered on the server
  when the payment step completes, with the confirmation email's variables (the
  `confirmation_page` context: `event`, `registration`, its `campers`, `pricing`, `invoice` —
  the registration invoice, with what's been paid on it and what's due — and, for older
  templates, `initial_payment`). It must read well when nothing has been paid yet (a check to
  send, or a PayPal payment that didn't go through). If it can't be rendered, the registration
  still completes, the registrant sees a short generic thank-you, and a report with each problem
  is emailed to the event's `confirmation_email_from` address.
- **When the confirmation email goes out** (§15, DR-91): when the flow reaches a result — they
  chose to pay by check, PayPal captured their payment, they finished to pay later, or there was
  nothing to pay — and otherwise half an hour after the registration was completed, by the
  worker (for someone who closed the page with PayPal's window open). It's sent once.
- Clears the saved localStorage form data and sent registration (unless the keep-data debug
  flag is set).
- If there's no confirmation data (e.g. direct navigation/refresh), redirects to step 1.

---

## 8. Admin Application

### 8.1 Choosers

- **Organization chooser:** lists organizations; selecting one navigates to its event chooser.
- **Event chooser:** lists events for the org; selecting one navigates into the Event Admin
  container for that event. It offers a way back to organization selection (placed as in §9.6,
  *Way back*).
- Both show who's signed in, with their Camphoric permission group, and Sign out (§6).
- Both show the server's version from `GET /api/version` beside the Camphoric title, in the place
  the Event Admin container shows the event's name (§8.2): `v` and the version (`v0.12.0`), or
  "unknown version" when the server reports none. Nothing shows while it loads (§15, DR-98).
- **Admins manage organizations** from the organization chooser (§15, DR-50): add one (a name),
  rename one, and delete one after confirming — refused, with the reason, while it still has
  events. Registrars and Reporters only see and open them.

### 8.2 Event Admin container and navigation

The event-admin area provides navigation among the event's admin functions, indicating the
current one, showing the event's name, and offering a way back to event selection (§8.1). The functions (each addressable at
`…/event/:eventId/<section>`, so they're linkable) are `home`, `registrations`, `campers`,
`lodging`, `reports`, `email`, `template-help`, `settings`; an unknown subpath falls back to `home`. (The routes are a
contract; the navigation's visual form is not.) The container shows who's signed in, with their
Camphoric permission group and Sign out, and marks the admin as read-only for a Reporter (§6).

Within each function the admin typically **finds/selects a record and views or edits its
details**. Two cross-cutting requirements (the presentation is the implementer's call):

- **Selection is URL-addressable** — the selected record, the open tab or view within a section
  or record editor (see §4 for each param; a default is left out of the URL, and an unknown or
  unavailable value falls back to it), and, for tables, the sort/filter/page state live in the URL so views are shareable, bookmarkable, and back/forward-friendly
  (e.g. `?registrationId=…`, `?camperId=…`, `?reportId=…`).
- **Data-heavy lists** (registrations, campers, invitations) support **sorting, filtering, and
  pagination** — handled client-side in the table over the full per-event dataset, which is small
  (≤~700 records; DR-19, DR-25); smaller lists need only lightweight client-side filtering
  (DR-20). Whether a record is reached via a side list, a
  master/detail split, a drawer, or full pages is left open.

### 8.3 Home / Event configuration

An interface to view and edit the event's top-level configuration; saving persists via PATCH to
the event:

- Event basics: `name`, `start`, `end`, `default_stay_length`. A cleared date is saved as
  `null`.
- Registration window: `time_zone`, `registration_start`, `registration_end` (§15, DR-97). The
  opening and closing times are picked and shown as clock times in the event's time zone, not the
  viewer's, with the zone named beside them, and are saved as ISO instants with an offset; a
  cleared one is saved as `null`. Changing the time zone keeps the clock times the admin
  entered (2 PM stays 2 PM, in the new zone).
- **Confirmation page** — its message, a Jinja markdown template edited in the template editor
  (§9.6) with the `confirmation_page` context and a live preview for a completed registration
  (§7.3).
- **Confirmation email** — `from` (the event's sending address), and the email's subject and body
  (its email template, edited as described below and saved with the rest).
- **Invoice email** — the subject and body of the email an invoice is sent with (§8.4; §15,
  DR-96), edited the same way and saved with the rest. It comes with the event, written to show
  the invoice's memo, description, amount due and due date, and a link to its pay page.
- PayPal: `paypal_enabled`, `paypal_client_id`, `epayment_handling` (the percent added to each
  payment made online, on the amount paid; §9.7).
- `pricing` (a freely editable set of named integer values) and `registration_template_vars`
  (named string values).

(Exposing the underlying JSON is a useful debugging aid.)

**Email templates** (the confirmation and invoice emails here, and invitation emails, §8.4) are the event's
email templates (§5; §15, DR-45), written in Jinja: the subject and the markdown body render on the
server against the event's variables (§9.3). The body is edited in the template editor (§9.6) with
the email's context (`confirmation_email`: `event`, `registration`, `campers`, `pricing`,
`invoice`, and `initial_payment` for older templates; `invoice_email`: `event`, `invoice` (with
its `pay_url`), `registration`, `campers`; `invitation_email`: `event`, `invitation`,
`registration_type`), and the
preview renders subject and body exactly as they'd be sent, for a sample the admin can choose (any
completed registration; any invoice of a completed registration; any of the type's invitations, or
an example invitation when there are none). Subject problems are listed with the body's; a template that doesn't parse can't be saved
(§5). Emails once written in Mustache were converted to Jinja when the templates were introduced;
Help's *From Mustache emails* guide still maps the old variables.

**When a Jinja confirmation email can't be rendered** at the end of a registration, the
registration still completes; the registrant is sent nothing, and a report is emailed to the
event's `confirmation_email_from` address instead — the event, the registration's id and admin
link, the registrant's email, and each problem with its line and the template text on that line.
(With no `from` address, the problem is only logged.) The admin can then fix the template and
send the confirmation by hand.

### 8.4 Registrations

This function covers two areas of work: managing existing registrations, and managing
invitation-based ("special") registration.

**Managing a registration.** The admin finds a registration (the registrations list is a
sortable/filterable table — columns such as primary camper, registration type, promo code,
balance, payment status) and works with it. The list holds every completed registration — one
is completed once its registrant pressed a payment button, paid or not (§15, DR-91). Payment
status is Paid (balance 0), Partial (some paid), Unpaid, or Refund due (balance below 0); a
registration whose registrant chose to pay online and it didn't go through (its registration
invoice is to be paid by PayPal or card, and is open) says so. For the selected registration
they can:

- **Edit core fields and attributes** — registration type, promo code (any of the event's live
  codes, or none; a deleted code the registration has is shown as deleted; §15, DR-67),
  registrant email, and the schema-driven `registration_schema` attributes (rendered in admin
  mode, §9.5). Persists via PATCH `{ registrant_email, registration_type, promo_code,
  attributes }`. The registration can be deleted
  after confirming (the confirmation shows the delete preview: its campers, invoices, payments
  and charges go with it, and it can be restored — §5; §15, DR-54, DR-55).
- **Edit admin-only attributes** — assembled from `registration_admin_schema` (a map of named
  `{ data, ui }` schema pairs combined, ordered by title). Persists via PATCH `admin_attributes`.
- **Review fees, invoices and payments** (§9.7) — every role sees the fee breakdown from
  `server_pricing_results` (labels from the pricing-logic vars; a promo discount labelled with
  the code's label), the ledger (the price; the handling fees on its invoices, when there are
  any; total owed; total paid; the balance due, or the refund due; and how much of the balance
  no invoice asks for yet), and each invoice: its description, where it came from (from
  registration, payment received, created by a registrar, converted), how it's to be paid, its
  due date, amount, handling fee, total, paid and due (or overpaid), status, memo and internal
  notes, and its payments — type, date, amount, `payment_schema` fields, notes — with each
  refund under the payment it gives money back from and how much of a payment has been
  refunded. An invoice with a PayPal order that wasn't confirmed says so.
- **Record a payment** (Registrars and Admins) — `payment_type` ∈ Check/PayPal/Card/Voucher,
  `paid_on`, `amount`, dynamic attributes, `notes`, and which invoice it pays: the oldest one with
  money due to start with (filling in what's due on it), any other open one, or "on its own" (a
  new "Payment received" invoice). An invoice can take more than one payment — a second check
  for the rest, say.
- **Make an invoice** (Registrars and Admins; §15, DR-96) — for more the registration owes (a
  meal plan added later) or the rest of the balance: a description, amount, due date, memo and
  notes. It starts as "Registration balance" for the balance no invoice asks for yet, and **Use
  the balance** fills that amount again. Paying it online adds the handling fee then.
- **Share an invoice's pay link** — every role can copy the pay link of an invoice with money
  due (§9.7; §15, DR-95), to send another way; Registrars and Admins can **send the invoice**
  (after confirming), emailing the registrant the event's invoice email (§8.3) for it. The email
  shows in the registration's email history.
- **Edit an invoice** (Registrars and Admins) — its description, amount, handling fee, due date,
  memo and notes. **Use the balance** fills the amount with what it asks plus the balance no
  invoice asks for yet; **Calculate** fills the handling fee the way the server charges it when
  the invoice is paid online — the event's percent of the amount less what's been paid on it,
  to the cent, a half cent up (§15, DR-88).
- **Cancel or reopen an invoice** (Registrars and Admins) — with a reason; nothing is owed on a
  cancelled one. One that still holds money (its payments don't net to 0) can't be cancelled.
- **Check a PayPal order** (Registrars and Admins) — for an invoice whose PayPal order wasn't
  confirmed: the server asks PayPal, and records the payment if it was captured, or clears the
  order if it wasn't (no money was taken).
- **Refund** (Registrars and Admins; §15, DR-94) — from a payment, give back some or all of
  what's left of it: through PayPal for a PayPal or card payment (PayPal returns the money and
  the refund is recorded), or record one made outside Camphoric (a check mailed back). An
  overpaid invoice offers to **refund the difference**, starting with the overpayment.
- **Delete** (Admins only; §15, DR-93) — a payment (after confirming; not one that has been
  refunded), or an invoice nothing was ever paid on. Registrars and Admins see the
  registration's deleted payments, with who deleted each and when, to restore them (§15,
  DR-55).
- **Override a price line** (Registrars and Admins; §15, DR-56) — set the amount of one of the
  registration's own lines (from `registration_pricing_logic`, e.g. a donation) with a reason,
  change it, or remove it (after confirming). Its campers' lines are overridden on each camper.
  An overridden line shows what the pricing works out for it, the reason and who set it — to
  every role; an override that isn't in effect is listed as such. The handling fee isn't a price
  line: it's edited on its invoice.
- **See its change history** (Registrars and Admins; §15, DR-53) — the registration's changes and
  its campers', invoices', payments' and custom charges', newest first: when, who ("Anonymous User" when
  no one was signed in, e.g. the online registration; a user since deleted by their email), what
  it was about, and each changed field's old and new value — attributes by their schema titles
  and only the keys that changed, ids by name (registration type, lodging, charge type), a price as its
  total. The changes one save made (an edit and the pricing it recalculated) are shown together.
  Old values are marked reddish and new ones greenish (the order also reads old → new, so color
  isn't the only cue). A value longer than 120 characters is cut short, with a way to see the
  rest. A long JSON value (an event's pricing logic or schema) or long multi-line text (an email
  template) is shown as a diff instead: both sides pretty-printed and compared line by line,
  with removed lines red (−), added lines green (+), two unchanged lines of context around each
  change and the other unchanged runs counted rather than shown. In JSON, each section is headed
  with where in the value its first change is — keys and list items by name, an item named by
  its `var`, `name`, `label`, `title`, `key` or `id` where it has one besides other fields, else
  by position ("in tuition › exp › if › item 2"). A long diff shows its first 12 lines, with a
  way to see it all (§15, DR-81).
- **See and reorder its campers** — listed by `sequence`, each linking to the camper function,
  with the ability to change their order (PATCH `sequence`).
- **Add a camper** (Registrars and Admins) — e.g. after registration has closed. The event's
  camper questions in admin mode, with the event's template variables, checked on submit like
  the registration form; `POST /api/campers/` `{ registration, attributes, admin_attributes: {},
  sequence }` puts them at the end of the list, and the registration's price is worked out
  again. The server checks the answers against the camper schema, with the registration
  schema's shared `definitions` (for its `$ref`s). Lodging is assigned afterwards.

(Exposing the raw record JSON is a useful aid.)

**Invitations and special registration types.** An interface to:

- **Invite a special registration** — choose a registration type and enter recipient name and
  email; this creates the invitation and sends it (`/invitations/{id}/send`). (The registration
  types themselves are created/edited in Settings, §8.8.) If the type's Jinja invitation can't be
  rendered, nothing is sent and the problem is shown (§5).
- **Track invitations** — a sortable/filterable list of the event's invitations (default newest
  first) showing name, email, type, sent status, and linked registration (if redeemed), with
  per-row resend/delete and — until it's redeemed — **copy registration link** (`register_link`),
  so an organizer can register someone themselves after registration has closed, or send the
  link another way. Status is derived: `redeemed` (has a registration); otherwise from its
  latest invitation email (§15, DR-44) — `sending` (queued or being sent), `sent`, `failed` or
  `not sent` (e.g. a `@dontsend.com` address), with the reason for the last two; otherwise `sent`
  if it has a sent time (sent before email was queued), else `unsent`. While an invitation's email
  is on its way, the list refreshes every few seconds. A redeemed invitation links through to its
  registration. One whose registration has since been deleted says so instead (it still counts as
  redeemed).

**Deleted registrations, campers and payments** (Registrars and Admins; URL-addressable as
`?registrationsTab=deleted`; §15, DR-55). The event's deleted registrations (with their camper
count), the campers and payments deleted on their own, each with when and by whom it was
deleted, and restoring one. A deleted registration's campers and payments come back with it, so
they aren't listed on their own; a camper or payment can't be restored while its registration is
deleted (the server's 409 says so).

### 8.5 Campers

The admin finds a camper (the campers list is a sortable/filterable table — columns such as
name, registration, lodging, the lodging they asked for, the other campers on the same
registration) and works with the selected one. The lodging shown is the camper's leaf unit; a
camper whose `lodging` is null or a non-leaf node reads "Unassigned", as on the lodging screen
(§8.6). For the selected camper, the admin can:

- **Edit the camper** — `camper_schema` in admin mode (admin-transformed UI schema; includes
  `registration_schema.definitions` for referenced types). Persists via PATCH `attributes`. The
  camper can be deleted after confirming (the preview lists its charges, and it can be restored;
  §15, DR-54, DR-55).
- **Edit admin-only attributes** — from `camper_admin_schema` (same pattern as registrations).
  Persists via PATCH `admin_attributes`.
- **See the camper's lodging** — the unit they're placed in (path, or "Unassigned") and their
  stay, the unit's notes, and the other campers in that unit with their stays, each opening that
  camper's record; and a way to the lodging screen with the camper selected (§8.6; §15, DR-72).
- **Set the lodging stay** — alongside the camper's lodging, a camper placed in a unit has the
  event days they're present ticked off, and the admin can change them (the days derive from
  event start/end; the last is departure day and can't be chosen, §8.6). The days are saved with
  the camper's other edits, in day order, and only when they've changed: PATCH `stay` (the
  selected days). A camper not yet placed has no days to set; placing them, with their days,
  happens on the lodging screen (§15, DR-103).
- **Review fees and custom charges** — fee breakdown from the camper's `server_pricing_results`
  (labels via `camper_pricing_logic`); list custom charges (date, type, amount, notes) with the
  ability to add (`camper`, `custom_charge_type`, `amount`, `notes`; a negative `amount` is a
  discount or credit, which can't take the camper's total below 0, §9.2) and remove them.
- **Override a price line** (Registrars and Admins; §15, DR-56) — as for a registration, for
  the camper's lines (from `camper_pricing_logic`): tuition, meals and so on.
- **See its change history** (Registrars and Admins) — as for a registration, for the camper and
  its custom charges.

(Exposing the raw record JSON is a useful aid.)

### 8.6 Lodging

This function manages the event's **lodging hierarchy** and **assigns campers to lodging units
across date ranges**, with capacity visibility. Required capabilities:

- **See unassigned campers** — those not yet placed in a leaf unit — with the context needed to
  place them: name, requested lodging, sharing preference/partner, and comments. Registration
  sets a camper's `lodging` to the node they requested, often a non-leaf (e.g. "Cabins"), so a
  camper whose `lodging` is null *or* a non-leaf node counts as unassigned.
- **Manage the lodging hierarchy** — view it as a tree showing, per node, occupancy vs. capacity
  (and reserved count), each node's children listed by name in natural order, as the timeline
  lists units ("Cabin 2" before "Cabin 10"; §15, DR-63), any node with nodes under it but the
  root collapsible to hide them (all start collapsed, so the tree opens at the root's children),
  and create/edit/delete nodes (deleting one unassigns the campers in it and in anything under
  it; §15, DR-54). A node has: parent, name, a title for
  its children, capacity (0 ⇒ auto-sum of children), reserved count, visibility, **availability**
  on the registration form — `auto` (by capacity, the default), `full` (always shown full) or
  `open` (never shown full; §15, DR-57) — and notes; for a non-leaf node the calculated capacity
  is shown, and a node marked full or open says so. A node with notes says so, and its notes can
  be read from the hierarchy without opening its edit form (e.g. an icon beside the node that
  opens them; §15, DR-70).
- **Assign and schedule campers** — place a camper into a leaf unit and set the **days they're
  present** (`stay`), and later move, reschedule, or unassign them. Assigning/scheduling persists
  via PATCH camper (`lodging`, `stay`); unassigning sets `lodging: null, stay: null`. A new
  assignment seeds its stay from the event's `default_stay_length`. **The event's last day is
  departure day:** campers leave by midday and no one stays over, so a stay never includes it —
  it can't be chosen, a stay placed or stretched toward it ends the day before, and an older
  stay that includes it loses it when next edited. (A one-day event keeps its only day.) The
  client enforces this; the server accepts any days (§15, DR-65).
- **Inspect a camper in place** — selecting a camper (in the unassigned list, the hierarchy, or
  the timeline) shows their lodging details without leaving the lodging screen, beside whichever
  view is open, so bars stay draggable while they're shown: the unit they're placed in and their
  stay, the unit's notes, the lodging they requested, whether they're sharing and with whom, their
  own lodging comments, the registration type, the registration's notes — its free-text fields,
  those its form renders as a textarea (§15, DR-60) — and the camper's answers in readable form
  (as in the registration review, §7.2). From there the admin can open the camper's record (§8.5)
  or unassign them. Selecting a camper never navigates away; a click that falls short of a drag
  just selects (§15, DR-61). Each view keeps its own selection, so details opened in one don't
  show in the other (§15, DR-71); it's URL-addressable (`?camperId`, `?timelineCamperId`, §4).
- **Inspect a lodging node in place** — selecting a node by its name in the hierarchy, or a
  unit or the node a group sits under on the timeline, shows that node's details beside the view,
  alongside any selected camper's: its path, occupancy vs. capacity (flagged when over), and every
  value its form sets — capacity (saying when it's the sum of the units under it), reserved
  count, sharing multiplier, the title for its children, visibility, availability on the
  registration form, and notes — plus, for a non-leaf, how many units are under it. From the
  node's details, on either view, the admin can edit the node (§15, DR-75). On the timeline, units and groups whose node
  has notes are marked. Selecting a node never navigates away; each view keeps its own selection
  (§15, DR-71), URL-addressable as `?lodgingId` and `?timelineLodgingId` (§4; §15, DR-70).

The screen has two views, each named for what the admin does there: the hierarchy is labelled
**Layout** and the timeline **Assignments** (§15, DR-74).

These must work efficiently across a whole event's campers and the event's date range. A
productive realization is a **calendar/timeline assignment view** — a column per event day,
campers shown as draggable/resizable bars spanning their stay, with unassigned campers dragged
in. If built that way, use dnd-kit with day-column snapping and a custom resize handle (DR-6),
with one drop target per unit rather than per day (§15, DR-62). The drag interaction is a
recommendation, not a requirement; what's required is the assign/schedule/unassign capability
and capacity visibility above.

**Finding units.** The units are listed grouped by where they sit — each group headed by its
parent's path ("Camp 1 → Cabin"; units directly under the root form a "Top level" group) — with
the groups ordered by that path and the units within a group by name, numbers in numeric order
("Cabin 2" before "Cabin 10"). The view can be narrowed to any set of lodging nodes, leaves
included (a top-level unit with no sub-units, such as Lark's "Off Site", is a leaf), picked from a
searchable list of full paths; it then shows every unit under any chosen node. The choice is
URL-addressable (`?lodgingFilter`, §4; §15, DR-63). Days are shown in local time (§10).

**Capacity & sharing rules:** campers attach only to **leaf** nodes; non-leaf nodes are
containers whose occupancy/capacity aggregate their descendants; `sharing_multiplier` and
`reserved` affect remaining-capacity figures (also surfaced to the registration-time lodging
selector).

### 8.7 Reports

The admin can **browse/select the event's reports** (selection via `?reportId`), **view a
report's rendered output**, and **create/edit/delete a report's definition**.

A report's **`variables_source`** says where its template's variables come from:

- **`server` — Camphoric variables.** The server builds the event's data itself (the
  relationship-resolved, read-only model of §9.3; §15, DR-35) and renders the template; the
  client posts nothing. New reports created in the client use this source.
- **`client` — the browser bundle (legacy).** The client assembles the template-variable bundle
  and posts it with each render. Existing reports keep this source until they're rewritten, and
  Handlebars (`hbs`) reports always use it.

The reports the data importer creates for new events (`data/`) all use Camphoric variables (§15,
DR-41); only reports saved in existing events before then still use the browser bundle.

- **Editing a report** — its title; its variables source; output format (`csv` Jinja→CSV, `md`
  Jinja→Markdown, `txt` Jinja→Text, `html` Jinja→HTML, and — for the `client` source only — `hbs`
  Handlebars→Markdown); and the template body. Title must be non-empty — surface that error.
  - **`server`** — the template is edited in the template editor (§9.6): autocomplete and hover
    docs from the variable spec for the `report` context, problems marked in the text, and a
    live preview in the chosen format. There is no variables schema.
  - **`client`** — the template is edited in Monaco with the language matching the format, plus
    the `variables_schema` (JSON, validated; it must parse before saving).
  - Changing the source of a saved report with a template asks for confirmation (the two sources
    have different variables, so the template needs rewriting); the text is left unchanged.
    Switching to `server` moves an `hbs` report to `csv`.
  - Saving writes `title`, `output`, `template`, `variables_schema` and `variables_source`.
    Deleting drops the `reportId` selection.
- **Viewing a report** — `csv`/`md`/`txt`/`html` render on the server via
  `/api/reports/{id}/render` (§5): `server` reports post `{}`, and legacy reports post the
  variable bundle, which is assembled only when a legacy (or Handlebars) report is shown. The
  returned string is shown per format:
  - **CSV** → parsed (`d3-dsv`) and shown as a table with a row count; downloadable.
  - **Markdown** → run through the markdown→HTML pipeline; downloadable.
  - **HTML** → shown in a sandboxed frame that runs no scripts; downloadable.
  - **Text** → shown as preformatted text; downloadable.
  - **Handlebars** (`hbs`) → rendered **client-side** through the template engine (Handlebars +
    markdown pipeline) using the variable bundle.
  - A `server` report's problems are listed with their template line and column (warnings, such
    as a misspelled field, appear above a successful render). A legacy report's render error is
    shown as its raw text.
  - The output, in every format, scrolls within its own area in both directions, at most about
    a window tall, so a wide or long report never widens or stretches the page; a CSV table's
    header row stays in view as it scrolls.

**Legacy report template variables** (the bundle assembled client-side and passed to
render/Template): `event`, `registrations` (augmented) + `registrationLookup`, `campers` +
`camperLookup`, `lodgingLookup`, `registrationTypeLookup`.

### 8.8 Settings

An interface to edit the event's JSON configuration directly (in Monaco), each piece saving back
to the event via PATCH:

- Schemas: camper, registration, registration UI, deposit, payment.
- Pricing logic: camper pricing, registration pricing. Each must keep a `total` component; the
  server refuses a save without one and the error is shown (§15, DR-69).
- Admin attribute schemas: registration admin attributes, camper admin attributes (each a map
  of named `{ data, ui }` pairs).

Registration types are also managed here: create/edit a type's machine `name` and `label`, and
its invitation email — subject and body, its email template (§15, DR-45), edited like the
confirmation email (§8.3) with the `invitation_email` context and a preview for any of the type's
invitations. A new type starts with a standard invitation, editable once the type exists. Types
persist via POST (new) / PATCH (edit) on `registrationtypes` (see §15, DR-32); the invitation via
PATCH of its template.

Promo codes are managed here too (§15, DR-67): the event's codes with their label, code, scope,
expiry and whether registrants can use one now (enabled and not expired); add or edit a code's
`label`, `code`, `scope`, `pricing_logic` (JSON, edited like the pricing logic; invalid JSON
can't be saved), `enabled` and `expiration_date` (POST / PATCH on `promocodes`); and delete one
after the usual preview. Registrars and Admins also see the deleted codes, with who deleted each
and when, and restore them. Any role can view a code.

**Validation messages** (the event's `registration_error_messages`, §7.1; §15, DR-34) are also
managed here. Admins can:
- list the event's messages, each shown as its field (by title, with the path), its error type
  (in plain language) and its message;
- add, edit and remove messages — choosing the field from every field the registration form can
  have (as registrants receive it, so conditional and server-built fields such as lodging are
  included) or typing a path directly; choosing the error type from those that can occur on
  that field; and seeing a live preview of the message with sample values;
- see the built-in messages that apply when no custom message matches;
- edit the whole map as JSON.

A second message for the same field and error type, an empty message, or a template that fails
to compile can't be saved; a path the form doesn't currently have is allowed with a warning (the
field may be added later). Changes are saved together, via PATCH of
`registration_error_messages` on the event.

**Email** — the admin chooses the **account the event sends through** (confirmations,
invitations and group email alike; or none, for the server's default mailer), and manages the
organization's **email accounts** (§5): add and edit an account — its name, whether it sends
through a mail server (SMTP) or only to the server's log (for testing), the server, port and
security (STARTTLS, SSL/TLS or none; changing the security moves a standard port along), the
timeout, username and password, its sending limits (most messages a minute and a day; blank is no
limit), and a default Reply-To (blank: each email's From address; §15, DR-47). The password is
never shown: when editing, a blank password keeps the stored one, and one the server can no longer
read (its encryption key changed) is flagged and must be entered again (§15, DR-46). The admin can
send a test message through an account (to themselves; it appears in the Email history, §8.9) and
delete an account no event or sent email uses (otherwise the server refuses, and the reason is
shown).

### 8.9 Email

Every email the event sends is queued and delivered in the background (§15, DR-44). The Email
section shows **what the event's email is doing now**, the event's **email templates**, its
**history**, and who has **unsubscribed** from its group email.

**Now** — how many emails are waiting (and when the next is tried) and how many failed in the
last day, refreshed every few seconds (every couple of seconds while email is waiting). Two things
hold email back, and each is explained when it happens:
- **No worker is running** — email is still queued and goes out once one runs again; the admin
  sees when a worker last reported in.
- **The sending account's limit is used up** — its email waits until a slot opens; the admin sees
  which limit (e.g. 500 in 24 hours) and when sending resumes. The short waits of a normal send
  kept to a per-minute limit aren't called out.

**History** — every email the event has queued, newest first: confirmations, invoices,
invitations, group email, the problem reports sent to the organizer (PayPal problems among them),
and tests. Each shows when, what kind, to whom,
the subject and its status (waiting, sending, sent, failed, not sent — e.g. a `@dontsend.com`
address), marking one that's waiting to be tried again after a failure. The admin can filter by
status and kind, search by recipient or subject, and page through (on the server; §5). Opening an
email (URL-addressable, `?messageId`, §4) shows who it went to and from, the account it was sent
through, when it was queued (and by whom) and sent, the attempts and the last problem, and exactly
what was sent (the HTML in a sandboxed frame, §9.6, and the plain text). A failed email can be
**retried**; a waiting one can be **stopped** before it's sent.

The history also lists the event's **group email sends**, newest first (the latest few, and all on
request): the template's name, when it was sent (or when it's scheduled) and by whom, and its
progress — sent, failed, not sent and still waiting, out of its copies, and how many were skipped
when it was prepared — refreshed like the history. A send that hasn't finished can be
**cancelled** (after confirming): a scheduled one sends nothing; one under way stops the copies
still waiting. A send's failed copies can be **retried** together. Choosing a send shows only its
copies in the history (URL-addressable, `?mbatch`, §4), until the admin shows all email again.

**Templates** — every email the event sends is an email template in Jinja (§15, DR-45):

- **Automatic emails** — the registration confirmation and each registration type's invitation,
  sent on their own when someone registers or is invited. They're listed with their subjects and
  lead to where they're edited: the confirmation with the event (§8.3), each invitation with its
  registration type (§8.8). They can't be deleted.
- **Group emails** — templates the admin sends to a group when they choose. Each is listed with
  its name, subject, default recipients (e.g. "Campers, 2 conditions") and when it was last
  changed. The admin can create one, edit it (URL-addressable, `?templateId`, §4), duplicate it
  (the copy opens for editing) or delete it (after confirming; emails already sent from it stay
  in the history).

**Editing a group email** — its **name** (for the admin; recipients don't see it), its **default
recipients**, its **sender** and its **message**:

- **Recipients** come from one of three sources, each with its own template context:
  - **Campers** — the event's completed registrations' campers (`bulk_email_camper`: `event`,
    `camper`, `registration`, `recipient`).
  - **Registrations** — the event's completed registrations (`bulk_email_registration`: `event`,
    `registration`, `campers`, `recipient`).
  - **Listed addresses** — typed one per line, as `email` or `Name <email>` (`bulk_email_manual`:
    `event`, `recipient`).

  For campers and registrations, the admin narrows the list with **conditions**, built without
  code: all or any of a list of *field → operator → value* rows. The fields come from the event
  (§5, `recipient-fields`), grouped (the registration, its answers, admin fields and pricing; for
  campers, also the camper's own), each with a type that decides its operators and its value:

  | Type | Operators | Value |
  |---|---|---|
  | text | contains, doesn't contain, is, is not, is set, isn't set | text |
  | number | = ≠ > < ≥ ≤, is set, isn't set | a number |
  | true/false | is true, is false | — |
  | choice | is, is not, is any of, is set, isn't set | one or several of the field's choices |
  | date | is before, is after, is on, is set, isn't set | a date |
  | list (several answers) | includes, includes any of, is set, isn't set | one or several values |

  No conditions means every camper or registration. Changing the source clears the conditions
  (they name the source's fields). A condition on a field the event no longer has stays visible
  and is marked. Under **Advanced**, a Jinja **filter expression** must also be true (e.g.
  `registration.balance > 0`), and Jinja **address and name expressions** give each copy's
  recipient; left blank, they default to the registrant's email (registrations), or the camper's
  `email` answer falling back to the registrant's, with the camper's first and last name
  (campers). The defaults are shown. The admin can also include registrations that weren't
  completed.

  As the recipients change, the admin sees **how many the audience reaches and how many it
  skips**, and on request the lists: each recipient (who they are, address and name, and whether
  this template was already sent to them) and each skipped one with why — no address, not a
  valid address, the same address as an earlier recipient (compared case-insensitively; each
  address gets one copy), an expression that failed for that one, or an address that
  unsubscribed from the event's group email. The count uses only the
  finished conditions; a condition still missing its field or value keeps the template from
  being saved. A problem in an expression or a condition is marked on its field. These are the
  *default* recipients: each send reviews exactly who gets it.
- **Sender** — the email account (default: the event's), the from address (default: the event's
  confirmation `from`) and the reply-to (default: the account's, else the from address; §15,
  DR-47).
- **Message** — subject and markdown body, edited with the email template editor (§8.3) in the
  source's context, previewed for any of the recipients the audience reaches.

Saving checks the subject and body, the expressions and the conditions on the server (§5), and
shows any problem on its field.

**Sending a group email** — the admin reviews exactly who gets it before it goes:

- **The recipients** start as the template's default recipients, all chosen. Each shows who they
  are, their address and name, and whether this template already reached them; the admin can
  uncheck or check each one, search, and choose all or none of those a search shows.
- **Choosing more** — for campers and registrations, an ad-hoc filter (conditions, the filter
  expression and incomplete registrations, as in the editor; the source and the address and name
  expressions stay the template's) finds recipients that are either **added** to the list (chosen)
  or **replace** it. Listed addresses come only from the template.
- **Left out** — those the recipients can't include (no address, not a valid address, a duplicate
  address, an expression that failed, unsubscribed), with why, on request.
- **Already sent** — when any recipient already got this template, "only send to those who
  haven't received it yet" is offered, on by default, with how many of the chosen it skips;
  skipped ones are marked in the list.
- **Sender** — the account, from and reply-to, starting as the template's (blank uses the
  defaults, as in the editor).
- **When** — now, or later at a chosen date and time, which must be in the future.
- **Test** — sends one copy, rendered for the first chosen recipient (or the template's first
  recipient), to the admin, with `[Test]` before the subject; nobody on the list is sent anything.

Sending asks for confirmation, restating the template, how many it goes to, the from address and
account, how many are skipped as already sent and how many were left out, and when it's sent. It
then creates the send with the chosen recipients' keys (§5); the admin is taken to the history,
showing that send's copies. Each copy is rendered when the send is prepared (at its time, for a
later send), from the template's subject and body as they were when it was sent; a recipient
who's no longer in the event's data, or who has unsubscribed since, is skipped, and a copy that
can't be rendered is recorded as failed with the problem while the others still go.

Each copy ends with a short footer saying which event it's about, with a link to **unsubscribe**
from the event's group email, and carries the same link as a one-click `List-Unsubscribe` header
(§15, DR-48). Following the link opens a page that asks to confirm; confirming — or a mail
provider's one-click unsubscribe — adds the address to the event's unsubscribed list. Tests and
the editor's preview don't have the footer.

**Unsubscribed** — the addresses that don't get the event's group email, newest first: each
address, how it got there (an email's unsubscribe link, or added by an organizer, named) and
when. Every group email leaves them out (as "Unsubscribed"); confirmations and invitations still
reach them. The admin can add an address (e.g. someone who asked by replying) and remove one
(after confirming), which lets group email reach it again.

### 8.10 Users

Admins manage who can sign in (§15, DR-50, DR-52); the screen and its API are hidden from
everyone else, and the way there (the user menu's **Users**) only appears for Admins. Users
opens over whatever admin page the Admin is on, filling the screen, and closing it returns to
that page exactly as it was — not reloaded, with its selection, scroll and any unsaved work
intact (URL-addressable, `?overlay=users`, §4; §15, DR-84). Escape closes the dialogs opened
within Users (editing a user, …), not Users itself.

- **The list** — every user: username and name, email, **Camphoric permission group** (Admin,
  Registrar, Reporter, or No access), whether they're deactivated, whether they've chosen a
  password yet, and when they last signed in. Superusers also see each user's **Django access**
  when it's more than a regular user's.
- **Adding a user** — username, email, first and last name, and their Camphoric permission group
  (default Reporter). By default they're emailed a link to choose a password; the admin may turn
  that off. A superuser also chooses the user's **Django access** — "Regular user" (the default),
  "Staff (for developers)" or "Superuser (for developers)" — and may instead **set a password
  now**, with "Require a password change at next sign-in" (on by default).
- **Editing a user** — the same fields, plus whether the account is active. A superuser is
  always an Admin; to change their group, change their Django access first (superusers only).
- **For each user** — email a set-password link (after confirming); copy a set-password link to
  hand over yourself (shown with when it expires); deactivate or reactivate; delete (after
  confirming — deactivating keeps the account and its history instead); and, for superusers,
  **set their password** (twice, with "Require a password change at next sign-in", on by
  default), which signs them out everywhere.
- **A user's change history** — choosing a user (their row, or *Change history* in their menu)
  shows, beside the list, what they changed (§15, DR-80): in every event, newest first, the
  changes one save made together, each named in full (which registration, event, report, …)
  with each field's old and new value as in a registration's history (§8.4: colored, long values
  cut short, long JSON and text diffed), and how many there are in all. Older changes load a page
  at a time. It stays open while the list is used, and the user is marked in the list; closing
  it, or choosing another user, is URL-addressable (`?historyUserId`, §4).
- **Guard rails** — nobody changes their own group or Django access, or deactivates or deletes
  their own account, so there's always an active Admin. Refusals from the server are shown.

**Passwords** (§6):

- **Choosing a password from a link** — the page a set-password link opens (§4) checks the link,
  names the account, and takes the new password twice; the server's password rules are shown
  under the field. Once set, it offers to sign in. A used or expired link says so and offers to
  email a new one.
- **Forgot password** — the sign-in form offers "Forgot password?", which takes an email address
  and always answers the same way, whether or not an account uses it.
- **Changing your own password** — from the user menu: the current password, then the new one
  twice.
- **A password to be changed** — when a superuser set someone's password and required a change,
  signing in shows only a "Choose a new password" form (and Sign out) until they do; a 403 saying
  so (from a request already under way) brings that form up too.

---

## 9. Shared Systems

### 9.1 JSON Schema Form engine

A wrapper around React JSON Schema Form (rjsf v6) with the `@rjsf/mantine` theme is the
backbone of both surfaces. The schema/uiSchema is the single source of truth. (Rationale and
the rjsf v4→v6 upgrade notes: §15, DR-4.) The wrapper must:

- Accept `schema`, `uiSchema`, `formData`, `onChange`, `onSubmit`, `onError`, a custom
  `templateData` object exposed to descendants via React context (so description fields can
  render templated help text), `errorMessages` (the event's validation messages, plus — for a
  form that renders part of the registration — a path prefix such as `campers.*` and the camper
  being edited), and `liveValidate` (validate on every change from the start).
- Apply validation messages (§7.1) to every validation pass, against the form's current data,
  rewriting both the inline message and the error-list text (§15, DR-34).
- On a failed submit, focus the first field (in page order) with a visible error, mapping each
  error to its field by rjsf's id scheme and walking up the path when the exact field has no
  control of its own (§7.1).
- Admin forms that render the registration (the camper and registration edit forms, §8.4,
  §8.5) use the event's messages too, validate live, and never block saving on validation
  errors — admins may need to save partial or legacy data.
- Wait for Google Maps to be injected before rendering **if** a Google API key is configured
  (spinner meanwhile); otherwise render immediately.
- Register the custom fields, widgets, and templates below.

**Custom fields:**
- **Campers** — array field for multiple campers; labels each "1st/2nd/… Camper" (ordinal),
  with add/remove controls.
- **Address** — composite address (street, city, state/province, zip, optional country) with
  optional address autocomplete on the street field via Google's `PlaceAutocompleteElement`
  (Places API New) that, on selection, populates all sub-fields; suppresses Enter-to-submit while
  the autocomplete list is open.
- **LodgingRequested** — cascading select that walks the lodging tree level by level; only a
  leaf may be the final choice; tracks the chosen path; shows its validation errors (including
  those for its `id`/`choices`) under the last dropdown. The server's lodging nodes (on the
  field's uiSchema as `lodging_nodes`) carry `full`; a full option is labelled "(full)" and
  can't be chosen (DR-57). Without `full` (an older server), a node with no
  `remaining_unreserved_capacity` is full.
- **Description** — renders schema/ui descriptions as templated markdown (via the Template
  engine and the form's `templateData`).

**Custom widgets.** The `@rjsf/mantine` base theme already provides the standard inputs —
including **Select** (enum with disabled options + value coercion), **Checkboxes** (inline +
disabled options), and text inputs with integer and datalist-examples support — so only the
genuinely additive widgets are layered on (§15, DR-29):
- **PhoneInput** — international phone entry (default country US), Mantine-native (§15, DR-30),
  saved in E.164 form (`+12025551234`). It asks the browser for a whole number to autofill
  (`autocomplete="tel"`). A value filled in all at once — by autofill or paste — without a
  leading `+` is a number in the selected country, so `(202) 555-1234` saves as
  `+12025551234`; a North American one that starts with `1` is read as giving its country
  code. A value with `+` and another country code switches the country.
- **NaturalNumberInput** — digits-only non-negative integer.
- **Select** — overrides the base select to show the field's description (templated markdown)
  between the label and the control, which the base widget omits. Choosing the option that's
  already chosen keeps it. An optional select can be cleared with an explicit clear control;
  a required one can't be emptied once answered. A field's `ui:options` (`allowDeselect`,
  `clearable`) override either (§15, DR-99).
- **Textarea** — overrides the base textarea to enforce `maxLength` truncation (guarding pasted
  or pre-filled overflow).
- **Checkboxes** — overrides the base checkboxes so the chosen values are saved in the order the
  schema lists its options, not the order they were ticked (§15, DR-66). Emails, reports and
  admin views then list the choices (e.g. attendance days) in a stable, meaningful order. It
  also shows the field's description (templated markdown) between the label and the
  checkboxes, which the base widget omits.

**Templates.** The base theme's templates render field layout, errors, help and objects (§15,
DR-29). The custom templates are:
- the **Description** renderer (`DescriptionFieldTemplate`) noted above, which renders
  schema/uiSchema descriptions as templated markdown via the Template engine and the form's
  `templateData`;
- an `ErrorListTemplate` that omits errors hidden as noise (§7.1);
- **lists** (`ArrayFieldTemplate`, `ArrayFieldItemTemplate`; §15, DR-49): an array field reads
  like any other section — its title as a section heading, its description, then its items — and
  each item is in its own bordered box with its remove (×) button in the box's top-right corner.
  The add button after the items says what it adds: `ui:options.addButtonText`, else "Add"
  and the item schema's title. Items can't be reordered unless the field's `ui:options` has
  `orderable: true` (the form defaults `ui:globalOptions.orderable` to false).

### 9.2 Pricing engine (`calculatePrice`)

A pure function computes a `PricingResults` object from the registration config and current
form data. **It must produce results identical to the server's `calculate_price`** (the
server remains authoritative; this is for live UX only). The server also applies registrars'
price overrides (DR-56); those only exist on registrations already submitted, so the form never
meets one and the client engine ignores them.

Inputs: `config.event` (`{ is_open, epayment_handling?, start?, end?, registration_start?,
registration_end? }`, each date as `{ epoch, year, month, day }`; the registration window's
`year`/`month`/`day` are its day in the event's time zone, its `epoch` the instant), `config.pricingLogic` (`{ registration: [...], camper: [...] }`),
`config.pricing` (named numeric vars), `config.dataSchema` (to find camper date properties), the
`formData`, and the applied promo code, if any (`{ code, label, scope, pricingLogic }`, §7.1).
The e-payment handling fee isn't part of the price: it's charged on each invoice paid online
(§9.7; §15, DR-88).

Algorithm:
1. Build a logic context `data = { event, registration: { ...formData, registration_type,
   created_at: {epoch,day,month,year} }, pricing, date }`.
2. Identify camper date properties (schema properties with `type: string, format: date`) so
   they can be converted from `"YYYY-MM-DD"` to `{ year, month, day }` for logic evaluation.
3. **Registration-level:** for each `{ var, exp }` component, evaluate `exp` with json-logic
   against `data`, store `results[var]` (NaN → 0), and feed it back into `data[var]` so later
   components can reference it.
4. **Camper-level:** for each camper, set `data.camper = { ...camper, index }` (converting its
   date props), then for each `{ var, exp }` component evaluate and store per-camper results;
   when the value is numeric/boolean, **accumulate** it into the registration-level
   `results[var]` (running total across campers) and feed back into `data[var]`. A camper's
   `total` below 0 is 0, both in its breakdown and in what it adds to `results.total`. Append
   the per-camper breakdown to `results.campers[]`. Once every camper is in, a `results.total`
   below 0 is 0 (§15, DR-68); only that sum is floored, not the registration-level `total`
   component on its own, so a registration-level credit still comes off the campers' totals.
5. **Promo code** (only when one is applied; §15, DR-67): its `pricingLogic` works out a
   discount, as a positive amount, after every other line. A result that isn't a number, or is
   negative, is 0; the discount never takes a total below 0.
   - `registration` scope: evaluated once against `data` without `camper`, with every
     registration-level result fed in (camper lines as their sums across campers, and
     `total`); capped at `results.total`.
   - `camper` scope: evaluated for each camper against `data` with that camper's `camper` (as
     in step 4) and that camper's own results fed in; capped at that camper's `total` (when it
     has a numeric one) and at what's left of `results.total`. Each camper's discount is stored
     as `promo: -discount` in its breakdown and taken off its `total`.
   The discount (for `camper` scope, the sum) is stored as `results.promo = -discount` and
   taken off `results.total`.

**Rounding money:** to the cent, a half cent up (away from zero), going by the amount as
written in its shortest decimal form, not the binary float under it: 2.675 rounds to 2.68. The
server's `money_fmt` and the client's `roundMoney` both work this way; `toFixed` and
`Math.round(x * 100) / 100` don't, and aren't used for amounts the two sides compare.

`PricingResults` is an open object (`total`, named subtotals, etc.) plus `campers: [...]` and
optional `promo`. Pricing rules work in whole dollars by convention.

> **TODO (future):** `calculatePrice` (client, `json-logic-js`) and `calculate_price` (server,
> `json-logic-qubit`) are a dual implementation kept in lockstep by tests (DR-14). Keep
> json-logic for now, but explore removing the parity risk entirely in the future — see §13.C.

### 9.3 Templating engine

Two engines render templates: **Handlebars in the client** (below) and **Jinja on the server**
(*Server-rendered Jinja*, at the end of this section).

Client-side, a two-stage rendering is used for descriptions, pre-submit content,
and Handlebars reports:

1. **Handlebars** compiles the template with the provided variables and custom helpers, then
2. a **markdown → HTML** pipeline (`remark-parse` → `remark-gfm` → `remark-rehype` with raw
   HTML allowed → `rehype-raw` → **`rehype-sanitize`** (extended to permit `class`/`style` on
   `div`/`span`) → `rehype-external-links` (external links open in a new tab) →
   `rehype-stringify`).

Output is inserted via `dangerouslySetInnerHTML`; sanitization is mandatory. Rendering errors
are caught and shown (in a `<pre>`) rather than crashing.

**Custom Handlebars helpers** (must be preserved): lookups (`getLodgingValue`,
`getRegistrationValue`, `getCamperValue`), array ops (`count`, `filter` with comparison
operators, `eachsort`, `eachrsort`, `eachLookupSort`), comparisons (`compare`, `lt`, `gt`),
math (`sum`, `subtract`, `abs`), and `or`. Template Help (below) documents them, each with an
example and its result.

**Server-rendered Jinja.** Reports with Camphoric variables (§8.7) and Jinja emails (§8.3,
§8.4, §8.9) render on the server, in Jinja, against a model of the event that the server builds
(§15, DR-35):

- **Variables** — each kind of template (a *context*) has its own root variables; a report gets
  `event`, `registrations`, `incomplete_registrations`, `campers`, `payments`, `invoices`,
  `lodging` (the root), `lodgings`, `registration_types`, `custom_charge_types`, `invitations`,
  `today` and `now`. `registrations`, `campers`, `payments` and `invoices` are those of
  completed registrations;
  `incomplete_registrations` are those started but never finished, which the server deletes,
  for real and with their campers, once nobody has changed one in 30 days, unless it has a
  payment (§15, DR-76). A
  confirmation email — and the confirmation page — gets the one registration it's for
  (`registration`, its `campers`, `pricing`, `invoice`, and `initial_payment` for older
  templates) and `event`; an invitation email gets `invitation`, `registration_type` and
  `event`; a group email's copy gets its recipient's registration or
  camper and `recipient` (§8.9).
  Relationships are resolved: `camper.registration`, `camper.lodging.full_name`,
  `registration.campers`, `lodging.all_campers`, `event.nights`, and so on. Money is a
  two-place decimal; dates and datetimes are real dates (datetimes in the server's configured
  template time zone).
- **The variable spec** — the describe endpoint (§5) publishes every context's variables, every
  type's fields (with docs and examples, including the event's own form questions and pricing),
  and the filters, tests and tags. It is the single source for the editor's autocomplete and
  hover (§9.6) and for help.
- **Methods of values** — the values are plain Python data, so templates can call their
  read-only methods (`registrant_email.split('@')`, `balance.is_zero()`,
  `camper.attributes.get('nickname')`). The variable spec lists a useful selection for text,
  numbers, money, dates, dicts and lists; Camphoric objects, form answers and pricing results
  are dicts and have the dict methods (§15, DR-86). Written with a dot, a method comes before a
  key of the same name: for a form question named `items`, `camper.attributes.items` is the
  method and `camper.attributes['items']` the answer.
- **Read-only** — templates can't change Camphoric objects (no `.update()`/`.append()` on them),
  but can build their own lists and dicts (`{% set rows = [] %}`, `namespace`, `merge`).
- **Sandboxed, with limits** — templates run in Jinja's sandbox (no Python internals, no model
  methods), with a render time limit and an output-size cap (§15, DR-37). Legacy reports also
  render sandboxed.
- **Diagnostics** — a render never fails with a traceback: syntax errors, undefined values,
  sandbox refusals, timeouts and the output cap come back as `TemplateDiagnostic`s (§5) with
  their line (and column where known). Using a field that a Camphoric type doesn't have (a typo
  such as `camper.frist_name`) renders blank and is reported as a warning, and so is printing a
  method instead of calling it (`{{ event.start.isoformat }}`, or `camper.attributes.items` for
  a question named `items`), with a message that says which. The read-only
  refusal's message points authors to the *Computed values* guide, so that topic keeps its
  title.

**Template Help.** Template authors get in-app help in two places: beside the template editor
(§9.6), and on a standalone page (`…/template-help`, §4) reachable from the admin navigation
and linked from the editor's help. Both offer, for one kind of template:

- **Variables** — the context's variables, then every type reachable from them (nearest first),
  then the Python value types those variables have (text, money, dates, `dict`, `list` …) with
  their methods; each field with its type, description, example, allowed values and whether it
  may be empty. Types link to their own entry (in `list<T>`, `list` and `T` each link to
  theirs); a type with a `base` says it also has that type's methods; the event's own types
  (its form questions and pricing) are marked as such. Generated entirely from the variable
  spec (§5; §15, DR-36, DR-86).
- **Filters, tests and tags** — each with its signature, description and example; Camphoric's
  own filters are listed first.
- **Markdown** — the GitHub-flavored Markdown that emails, the confirmation page and Markdown
  reports are written in: paragraphs and line breaks (a single line break is joined unless the
  line ends with `\` or two spaces), headings, emphasis, lists, links, images, tables (with
  `md_cell` for values in cells), dividing lines, quotes, code, escaping, and HTML (allowed in
  sanitized form on pages, dropped from emails). Each construct has an example and, except
  images, its rendered result; an opening line says how the chosen kind of template's output is
  used (an email's body becomes its HTML and is sent as is as its plain text).
- **Search** across the variables, the filters, tests and tags, and the Markdown reference, by
  name, title, type, description or example; a type whose name matches is shown whole.
- **Guides** — short topics: Jinja basics; loops, sorting and grouping; computed values (own
  lists and dicts, `merge`, `namespace`, macros); money, dates and CSV; lodging; common errors
  (including the printed-method warnings above);
  moving from legacy reports (a mapping from the bundle's lookups to the linked variables);
  moving emails from Mustache (a mapping of each email's variables); and the Handlebars helpers
  (from the helpers' own help text).

Beside the editor, choosing a variable, field, filter, test, tag or Markdown example inserts it
at the cursor (`name`, `.field` or `['key']`, `| filter`, `is test`, a tag snippet, or the
example). The standalone page
lets the admin choose the kind of template, keeps its state in the URL (§4), and offers
**Download sample variables**: the chosen context's variables rendered as JSON from the event's
real data through the preview endpoint (§5), using the template
`{{ dict(<root>=<root>, <list root>=<list root>[:3], …) | dump(2) }}` — lists cut to their first
three items, Camphoric objects two levels deep with deeper links as `{"$ref": "type:id"}`.

### 9.4 Search

Smaller admin lists use `match-sorter` for client-side filtering and ranking (case-insensitive;
predictable starts-with → word-starts-with → contains → acronym → fuzzy ordering; empty queries
show the first N — typically 10 — records), over entity-appropriate fields. Data-heavy lists
(registrations, campers, invitations) instead use the data-table filtering in §8.2 — column and
global filters via `@tanstack/match-sorter-utils`, run client-side over the full per-event
dataset (small enough at this scale — DR-25; see also §15, DR-19, DR-20).

### 9.5 Admin vs. registrant form mode

The same JSON Schemas drive public and admin forms, but admin editing uses a transformed UI
schema that strips registrant-only constraints (e.g. removes `enumDisabled` so admins can pick
otherwise-disabled options) and includes shared schema `definitions`. A V2 must keep a single
schema source of truth and derive the admin UI from it.

### 9.6 Shared UI capabilities

The app needs the following shared building blocks. They're named here by **capability**, not by
component — realize them with Mantine primitives (or otherwise) as you see fit.

- **Focused/dialog surface** — a modal-or-equivalent for create/edit/confirm flows, including a
  confirmation step for destructive actions and a busy/disabled state while saving.
- **Loading indicator** — inline and full-surface variants.
- **Code/JSON editor** — a single **Monaco**-based editor for all JSON/template/schema editing
  (report templates, raw event schemas, admin/plugin config), with JSON-schema validation where
  applicable. V2 standardizes on Monaco (drops `vanilla-jsoneditor`; see §15, DR-8). Monaco and its
  web workers are bundled with the app and served with the rest of the static build; nothing is
  loaded from a CDN at runtime. Only what the admin uses is included: the editor's features,
  JSON (validated in its worker), highlighting for the legacy report formats (Handlebars,
  Markdown, HTML), and the template editor's own Jinja language (§15, DR-58).
- **Template editor** — the Monaco editor specialised for server-rendered Jinja (§9.3), used
  wherever such a template is written (server-source reports, §8.7). Given the event and the
  template's context, it provides (§15, DR-36):
  - **Jinja highlighting** — delimiters, comments, tags, filters, strings, numbers — with
    `{{ }}`, `{% %}` and `{# #}` auto-closed.
  - **Autocomplete from the variable spec** (§5) inside `{{ }}`/`{% %}`: the context's
    variables and globals; after `.`, the fields of the expression's type, then the methods it
    inherits from its `base` (a camper's `get`, `items` …), and for a list the methods of `list`
    — following chains (`campers[0].registration.`), keys (`['key']`, and `.get('key')`), method
    calls (by their result type, e.g. `name.split(' ')` → `list<string>`), loop and assignment
    variables (`{% for %}` with `loop`, `{% set %}`, `{% with %}`, macro parameters), and list
    filters (`| first`, `| sort`, `| selectattr`, `| map(attribute=…)`); after `|`, filters;
    after `is`, tests; after `{%`, tag snippets. A `.name` resolves to the base type's method
    before a key of the same name, as Jinja does; `['name']` to the key. Each suggestion shows
    its type and its doc/example. Keys that aren't identifiers are inserted as `['key']`;
    methods are inserted with parentheses. The event's own form questions sort first, inherited
    methods last.
  - **Hover docs** — the type, doc and example of the variable, field, filter, test or tag
    under the pointer.
  - **Live preview** — the unsaved text is rendered by the preview endpoint (§5), debounced,
    with the previous result kept on screen while the next renders. The output is shown in its
    format (CSV table, sanitized markdown, sandboxed HTML, text, or an email's subject and
    body), with the sample record it was rendered for and the render time, and a notice when
    it was cut off.
  - **Problems** — the preview's diagnostics are listed (errors first) and underlined in the
    text at their line/column; choosing one moves the cursor to it.
  - **Help** — Template Help for the editor's context (§9.3) can be opened alongside the editor
    without blocking it, inserts entries at the cursor, and links to the standalone help page.
  - **Room to write** — the preview can be hidden so the text gets the editor's full width; its
    problems stay underlined and their count stays visible. The editor can also be expanded to
    fill the screen, with the preview (which can still be hidden) and help, and edits made there
    are the same unsaved text the page holds. Escape in the expanded view belongs to the editor
    (dismissing suggestions), not to closing it (§15, DR-73).

  Several template editors can be open at once, each with its own context.
- **Unsaved changes** — where a template is edited (Home, §8.3; a registration type's
  invitation email, §8.4; a report, §8.7; a group email, §8.9), leaving with changes not yet saved asks first, warning that the changes will be lost,
  and offers to keep editing or discard them. Leaving is any navigation — a link, back or
  forward, a change of the URL-addressable state that closes the editor (choosing another
  report, closing a group email's editor) — as well as reloading or closing the tab (the
  browser's own prompt), and the page's own ways of dropping the edits: Cancel, closing the
  dialog, starting a new report. Saving, leaving an editor whose text is unchanged, and opening
  or closing Users over the page (§8.10, which leaves the page as it is) don't ask. Any field of
  the form counts as a change — on Home, every setting it saves, not only its two templates; a
  value changed and changed back doesn't count (§15, DR-79, DR-85).
- **Form actions** — on every admin screen or dialog where something is edited and saved (an
  event's settings, a registration, a camper, a report, a user …), the form's actions (Save, and
  any Cancel, Close or Delete) can be reached at any scroll position: while the form is on
  screen, Save is visible without scrolling to its end, whether the page or the dialog is what
  scrolls. They don't cover the field being edited, on a phone included: at the end of the
  form they sit after its last field, and a field moved to with the keyboard is brought into
  view clear of them. Where the screen tells whether its edits are unsaved (Home, validation
  messages, a report, a group email), the actions say so. They follow the read-only state
  (§15, DR-51): a Reporter sees only what they can use, such as Close, and none where there's
  nothing. The unsaved-changes prompt above applies to Cancel and Close as before. All the
  screens share one realization of this, so they behave alike (§15, DR-102).
- **Way back** — a screen that offers a way back up to where it was reached from (the event
  chooser back to organization selection, the Event Admin back to event selection) puts it in the
  app header, at the far left, immediately before the "Camphoric Admin" title, as a back-arrow
  icon button whose accessible name says where it goes ("Back to event selection"). It isn't
  repeated in the page body. Every new way back follows this placement (§15, DR-82).
- **Light or dark mode** — every page, public and admin, offers a choice of **Light**, **Dark** or
  **System** (follow the operating system, §10), reached from the top right of the page. System
  is the default; the current choice is shown. The choice applies at once, is remembered in this
  browser (not with the account, so it works the same signed in or not), and carries to the
  browser's other open tabs; choosing System goes back to following the operating system
  (§15, DR-101).
- **Error boundary** — isolates failures in risky subtrees (the registration form, invitation
  context, report rendering); shows detail in dev, fails quietly in prod. (This one *is*
  architectural, not just visual.)
- **Object/JSON viewer** — read-only rendering of arbitrary objects, for the raw-record aids.
- **Inputs** — labeled text/number/textarea, a money input, and an editor for a freely editable
  set of key/value pairs.
- **Registration chrome** — the live price total, the per-step page framing, and the
  closed-registration / invitation context described in §7.

### 9.7 Invoices, payments and balance

Money a registration owes, pays and gets back is kept in **invoices** and **payments**, on the
server (§15, DR-87). The developer guide `doc/payments.md` walks through it with diagrams; this
section is the contract.

- **A registration's states.** *Started*: the form was sent, not yet a payment button
  (invisible in the admin lists; deleted after 30 untouched days, §15, DR-76). *Completed*: a
  payment button was pressed — Pay by check, PayPal or Card, or Finish registration when nothing
  is owed (§15, DR-91). From then on it's in every admin list, unpaid until a payment arrives.
- **Invoice.** A request for one chunk of the balance: `amount` toward the registration, plus
  `handling` — the e-payment handling fee, added only when it's paid online. Every payment
  belongs to exactly one invoice, and an invoice holds any number of payments and refunds.
  Its `origin` says where it came from (informational only):

  | Origin | Made by | When | Typical description | Special behavior |
  |---|---|---|---|---|
  | `registration` | the payment step | the registrant pressed a payment button for an option that asks for money (at most one per registration) | the option's title ("50% Deposit") | rewritten by the payment step while nothing is paid on it (a changed option or method); templates call it `registration.invoice` |
  | `payment_received` | recording a payment | a payment recorded with no invoice that has money due, or "on its own" | "Payment received" ("Refund given" for a refund converted from before invoices) | its amount always equals what its live payments net to, so it never shows money owed; cancelled when its payments are deleted, reopened on restore |
  | `admin` | a registrar | made by hand, for an amount or the balance no invoice asks for yet (§15, DR-96) | what the registrar types ("Registration balance") | none |
  | `migrated` | the conversion to invoices | an old handling fee with nowhere else to go | "Electronic payment handling" | amount 0, only `handling` |

- **Status** is worked out from the invoice and its live payments, never stored: `cancelled`;
  `overpaid` (paid more than its total); `paid`; `partially_paid`; `open`.
- **The ledger.** `total_owed` = the priced `total` + the `handling` of the invoices that aren't
  cancelled. `total_paid` = the live payments, refunds subtracted. `balance` = `total_owed −
  total_paid`; negative means a refund is due. `uninvoiced_balance` = the balance no open or
  partially paid invoice asks for yet (never below 0). Templates (`registration.total_owed`,
  `total_paid`, `balance`) and the API agree.
- **Where a payment goes.** Recorded with an invoice, on it (same registration, not cancelled).
  Without one, on the registration's oldest invoice that still has money due; with none, on a
  new `payment_received` invoice for exactly it. A registrar's payment never adds a fee.
- **Payment options** (#675; §15, DR-89): the event's deposit choices (`registration_deposit_schema`,
  `oneOf` of `{ const, title }` or `enum` + `enumNames`, each const the JSON of `{ name, logic }`)
  are evaluated on the server against the registration's stored pricing results — a result that
  isn't a number is the total, and it's kept within 0 and the total. With no choices there's one
  "Full payment" option. Each option's `handling` is the fee on its amount when the event takes
  payments online.
- **The handling fee** (§15, DR-88) is the event's `epayment_handling` percent of the invoice's
  amount still due, to the cent, a half cent up, added to the invoice when it's paid online —
  never part of the price. Paying by check adds none; a deposit paid online carries a fee on the
  deposit only. Registrars and Admins can change it on the invoice.
- **PayPal** (§15, DR-90). The server creates each order — for the invoice's amount due plus
  the fee, with one item "Total for Invoice #{id} for {Event Name}", `reference_id` the
  registration's uuid and `custom_id` `invoice:{id}` — and keeps it as the invoice's pending
  order; nothing is owed for it until it's captured. On approval it fetches the order, checks it
  belongs to the invoice, and captures it only if it's still for what the invoice asks now. A
  capture is recorded as a payment with PayPal's capture id as `paypal_transaction_id` (unique);
  an order found already captured is recorded (or returned) rather than captured again. Outcomes
  that don't record a payment: *amount changed* and *declined* (no money taken), and *unknown*
  (PayPal's answer was lost; money may have moved) — the order stays pending, and a **PayPal
  problem email** goes to the event's `confirmation_email_from`: what happened, who
  (registration, registrant, campers, an admin link), what for (invoice, amounts, payment type),
  PayPal's references and error, what the registrant was told, and what to do ("Check PayPal
  order"). It's sent once per order and always logged.
- **The pay page** (#670, #623; §15, DR-95). Every invoice has an unguessable link code and a
  public page at `/invoices/{code}` (its `pay_url`). Anyone with the link sees the event's name,
  the invoice — number, description, memo, due date, amount, handling, paid and due, and its
  status — and the campers as first name and last initial; never its notes or the registrant's
  email. While money is due on it, it isn't cancelled and the event takes payments online, the
  page offers PayPal's buttons for the amount due plus the handling fee (none when the invoice
  already carries one); the server creates and captures the order as on the payment step, with
  the same outcomes. So an invoice first meant for a check can be paid online, adding the fee
  only then; if PayPal's script can't load, the page says so, as on the payment step. Otherwise
  the page says the invoice is paid, cancelled, or can't be paid online; and when a PayPal order
  on it hasn't been confirmed, it asks the payer not to pay again.
- **Refunds** (§15, DR-94) are payments with a negative `amount` on the refunded payment's
  invoice (`refund_of`), never more than is left of it. A PayPal or card payment is refunded
  through PayPal's refund API on its capture (with a request id made once per attempt, so a
  retry refunds once; the refund's id is its `paypal_transaction_id`); a lost answer sends the
  PayPal problem email. Others are recorded by hand. A refunded payment can't be deleted.
- **Cancel and delete.** Registrars and Admins cancel and reopen invoices; one that still holds
  money can't be cancelled. Only Admins delete a payment or an invoice (§15, DR-93): not a
  refunded payment, nor an invoice anything was ever paid on.
- **Confirmation email timing** (§15, DR-91): sent when the payment flow reaches a result, or by
  the worker 30 minutes after completion when nothing did; once (`confirmation_sent_at`, and its
  dedupe key).

---

## 10. Cross-Cutting Concerns

- **Money:** formatted to two decimals; computed in whole dollars.
- **Dates/times:** Luxon (`DateTime`) with explicit timezone handling; form date values are
  `YYYY-MM-DD`, datetimes are ISO with offset. Camper `stay` is an array of `YYYY-MM-DD`
  strings. Pricing logic receives dates as `{ year, month, day }` objects. Dates are **displayed
  in the viewer's local time**, except the registration window, which is entered and shown in
  the event's time zone (§8.3; §15, DR-97). A date-only value is read as local midnight of that same day, so
  its label names the calendar day it holds; arithmetic that only builds `YYYY-MM-DD` strings
  (such as listing an event's days) may use a fixed zone (§15, DR-64).
- **CSRF & credentials:** every request includes credentials; mutations send `X-CSRFToken`
  from the cookie set at bootstrap.
- **Loading discipline:** components render a spinner until their required queries resolve;
  detail panes render nothing until a selection exists.
- **URL as state:** admin selections live in query params; registration step lives in the
  path; invitation code lives in the query string and is threaded through redirects.
- **Cache invalidation:** rely on TanStack Query key invalidation; mutations that affect
  derived totals must invalidate `Registration`/`Camper` query keys as appropriate.
- **Errors & notifications:** one strategy — Mantine `@mantine/notifications` toasts for mutation
  success/failure via a shared TanStack Query `MutationCache.onError` (opt-out per call), plus
  inline field errors on forms (§15, DR-10). A 403 reads "You don't have permission to do that."
  (§6).
- **Data freshness & optimistic updates:** admin queries use a short `staleTime` and refetch on
  window focus; the registration config does not refetch on focus. Drag/reorder mutations
  (lodging assignment, camper `sequence`) are optimistic with rollback on error; other mutations
  invalidate-and-refetch (§15, DR-16).
- **Colour scheme:** the client follows the operating system's light/dark preference
  (`prefers-color-scheme`), on every surface, and switches when the preference changes while a
  page is open. Where the browser reports no preference, it is light. A person can choose light
  or dark instead (§9.6, *Light or dark mode*). The scheme is in place before the app's script
  loads, so a page never shows the other scheme first (§15, DR-100).
- **Debug aids:** a `debug()` logger that prints only when a `DEBUG` localStorage flag is set
  (in any environment, so a deployed site can be traced from the browser console); the
  registration step logs each form change with its recomputed totals, validation errors and the
  submit result through it. Every form also traces each validation pass: per error, the raw
  validator error, the context the messages were resolved with (path prefix, camper, form data,
  rule count), the lookup path, and which message key matched (and from where) — or that none
  did — plus any error hidden as noise or template that failed to render (§7.1). Raw JSON views on admin detail screens; in dev, the registration
  `onChange` is exposed on `window` for autofill, and a `KEEP_REG_DATA` flag preserves
  localStorage across confirmation.

---

## 11. Non-Functional Requirements

- **Server authority:** the client never trusts its own pricing for money movement; it submits
  its computed pricing but always adopts the server's returned `serverPricingResults`.
- **Security:** all rendered HTML from templates/markdown must be sanitized; external links
  open in a new tab; never render unsanitized user/template HTML.
- **Resilience:** bootstrap retries CSRF/user fetch on failure; error boundaries isolate
  failures in the registration form, invitation banner, and report rendering.
- **Performance:** debounce localStorage writes during form editing; normalize list data into
  id-keyed lookups for O(1) access in detail views.
- **Bundle split — registration is the priority:** the public **camper registration** flow must
  load as **lean and fast as possible** (it's the mobile-facing, first-load-sensitive surface).
  The entire **admin** application and its heavy, admin-only dependencies are **code-split behind
  the `/admin` routes and lazy-loaded** so none of it ships in the registration entry bundle — in
  particular **Monaco** (bundled, DR-58; loaded only when a report/schema editor opens),
  `@tanstack/react-table`, `dnd-kit`, and the reports/templating tooling. Keep the registration
  bundle to what the form, pricing, and payment flow actually need (PayPal's SDK loads at the
  payment step); admin code may be heavier but should still code-split per section.
- **Accessibility/UX:** scroll to the error summary and focus problem fields on validation
  failure; show progress/disable interaction during payment.
- **Data-driven by design:** virtually all form structure, pricing, templates, and admin
  attributes come from server-configured JSON Schemas / JSON Logic / templates — the client
  must render whatever the event defines without code changes.
- **Responsive targets:** the public registration flow is mobile-first (usable down to ~360px);
  the admin is desktop-optimized (≥1024px), usable-but-not-optimized on tablet, and not designed
  for phones (§15, DR-17).

### Testing & quality gates

- **Tests ship with the code that they cover.** Every feature lands with its tests in the same
  change — pure logic with unit tests, components with component tests — rather than deferring
  testing to a later pass. A change that adds or alters behavior is incomplete until its tests
  exist and pass (§15, DR-28). Tests (`*.test.ts(x)`), Storybook stories (`*.stories.tsx`) and test
  fixtures live in a `test/` directory inside the folder of the code they cover — e.g.
  `components/form/test/JsonSchemaForm.test.tsx` — and import that code from `../` (§15, DR-43).
  Shared test utilities and the Vitest setup live in `src/test/`.
- **Unit (Vitest):** thorough coverage of the **pricing engine** and template helpers, plus
  date/money utilities and other pure functions.
- **Pricing parity:** a shared fixture set (inputs → expected `PricingResults`) run against
  **both** `calculatePrice` (client) and `calculate_price` (server) in CI; any pricing change
  updates both sides (§15, DR-14).
- **Component (React Testing Library):** the form engine (custom fields/widgets/templates) and
  key admin screens.
- **E2E (Playwright):** component e2e drives the Storybook stories (the form engine, templating,
  the data table, and admin widgets) against a static Storybook build, plus a registration-flow
  smoke against the dev server; every test runs on desktop and two mobile devices (§15, DR-31,
  DR-59). The
  registration smoke skips when no backend is reachable (as in CI).
- **Gates:** type-check, lint, unit tests and the e2e suite pass in CI (the *Client v2* workflow,
  on every push/PR that touches `client_v2/`) and in the pre-commit hook (§15, DR-15).

---

## 12. Behaviors to Preserve (and Pitfalls to Improve in V2)

These are subtle, load-bearing behaviors observed in the current client. Preserve the intent;
a V2 may implement them more cleanly.

- **Client/server pricing parity** is a hard requirement — divergence shows the registrant a
  different total than they're charged. Any change to `calculatePrice` must mirror the server.
- **The server decides every amount on the payment step** — each payment option's amount and
  handling fee come from the server, and the payment step posts the option's *name*. Never
  compute a deposit or a handling fee in the browser (§15, DR-89).
- **The browser never creates or captures a PayPal order** — PayPal's buttons ask the server
  for the order and hand the approved order back for the server to capture (§15, DR-90).
- **A payment button completes the registration** — after a cancelled or declined PayPal
  payment the registrant is registered and unpaid; say so, and let them try again, pay by check
  or finish and pay later (§15, DR-91).
- **Separate server-state from client-state** — server data lives in TanStack Query (keyed by
  entity + filter params, across the two API roots `/api` and `/api/events`); the only global
  client store is the small Zustand store for the in-progress registration. Don't push cached
  server data into the client store.
- **Trailing slashes** on every admin API path are required by the backend.
- **localStorage rehydration keyed on schema title + event start** — clear it after
  confirmation; beware stale data across events.
- **Multi-key invalidation** for mutations that affect derived totals (`Camper`, `Payment`,
  `Invoice`, `CustomCharge` → also invalidate `Registration` queries; `Payment` ↔ `Invoice`).
- **Admin UI schema derivation** (stripping `enumDisabled`, injecting `definitions`) keeps one
  schema source for two audiences — retain a single source of truth.
- Several form/focus workarounds exist (phone-field focus, Enter-suppression in address
  autocomplete). Re-evaluate whether the chosen V2 form library still needs them.

---

## 13. Open Questions and Decisions to Resolve

The library, architecture, and process decisions are settled (see §15, Decision Records). The
items below are **deferred from V1** — they aren't blockers and several depend on backend work
that is out of scope for this pass.

### A. Deferred product decisions

- **Bank deposits admin UI.** The `Deposit` entity and `deposit_schema` describe a *bank
  deposit* that groups payments (not the registrant's deposit option, which is a payment
  option, §9.7). There's no admin screen to view/manage `Deposit` records; revisit if organizers
  need to view/reconcile/batch deposits.
- **Receipts for payments made later.** A registrant gets one confirmation email; a payment a
  registrar records, or one found by "Check PayPal order", sends nothing. Decide whether
  payments (and refunds) after the confirmation should email a receipt.

### B. Deferred with the plugin system (§14)

The plugin open questions in §14.10 are deferred along with the feature: build-time vs. runtime
loading, server-side plugin hooks, registry source of truth, org- vs. event-level activation,
and contribution-conflict handling.

### C. Future exploration

- **Eliminate the dual pricing implementation.** Client `calculatePrice` (`json-logic-js`) and
  server `calculate_price` (`json-logic-qubit`) must produce identical results (DR-14), but they
  are two implementations kept in sync by tests. Keep json-logic for now; in the future explore
  removing the parity risk entirely — e.g. a single shared pricing module both runtimes call, a
  compiled/WASM core, or generating one side from the other.

---

## 14. Future Feature: Plugin System

> **Status: design proposal for a future release.** Not part of the initial V2 build. This
> section captures the intended shape so the core is built with the right seams.

### 14.1 Goals

- Plugins are distributed as **npm modules** ("installed" into the client/build like any
  dependency).
- Plugins can be **activated per event**, independently, by an admin.
- Each plugin can store **per-event configuration/data** (a JSON blob), editable in admin.
- Plugins extend the app at **well-defined extension points** (custom registration fields,
  admin screens, report helpers, dashboard widgets, lifecycle hooks) without forking the core.
- The core stays authoritative for money and persistence; plugins enhance UX and add features,
  they do not become a trust boundary for pricing (see §14.9).

### 14.2 Concepts and backend models

Two backend models (following the backend conventions in `CONTRIBUTING.md`: inherit
`TimeStampedModel`, use `CustomJSONField`, validate JSON against a schema, expose via
`ModelViewSet` on the trailing-slash router):

- **`Plugin`** — the registry of plugins known to the deployment.
  - `name` (unique; **matches the npm package name**, e.g. `@camphoric/plugin-waiver`)
  - `version`, `display_name`, `description`
  - `enabled` (global kill-switch)
  - optional cached `config_schema` (the JSON Schema the plugin declares for its per-event data)
  - timestamps (via `TimeStampedModel`)
- **`PluginEvent`** — the per-event activation + data (join of `Plugin` × `Event`).
  - `plugin` (FK → `Plugin`), `event` (FK → `Event`) — `unique_together`
  - `active` (bool) — whether this plugin is on for this event
  - `data` (`CustomJSONField`) — arbitrary per-event plugin storage/config
  - validate `data` against the plugin's `config_schema` on write, mirroring the existing
    `validate_attributes` pattern.

**API.** Standard CRUD viewsets: `GET/POST /api/plugins/`, `GET/POST/PATCH /api/pluginevents/`
(with `filterset_fields = ['event', 'active', 'plugin']`). The two existing event-config
payloads must also surface active plugins so the client can load them without an extra
round-trip:
- the **registration config bundle** (`GET …/register`) includes the active plugins relevant to
  registration plus each one's `data`;
- the **admin event load** exposes active `PluginEvent`s (`{ plugin, active, data }`) for the
  event.

### 14.3 Loading and activation model

Recommended for v1: **build-time registration + runtime, data-driven activation.**

- Plugins are real npm dependencies, bundled at build time and **code-split** behind dynamic
  `import()` so an event that doesn't use a plugin never downloads it.
- A small **registry** maps a plugin's package name to a lazy importer, e.g.:
  ```ts
  // plugins/registry.ts  (hand-maintained or codegen'd from package.json)
  export const pluginRegistry: Record<string, () => Promise<{ default: CamphoricPlugin }>> = {
    '@camphoric/plugin-waiver':   () => import('@camphoric/plugin-waiver'),
    '@camphoric/plugin-tshirts':  () => import('@camphoric/plugin-tshirts'),
  };
  ```
- At event load, the host reads the active `PluginEvent`s, looks each `plugin.name` up in the
  registry, dynamically imports it, validates host/SDK version compatibility (§14.8), calls the
  plugin's `setup(ctx)`, and merges its contributions into the extension points.
- If a `PluginEvent` references a plugin **not present in this build** (installed server-side but
  not in the client bundle), show a clear diagnostic rather than failing silently.

> **Escalation path (later):** to "install a plugin without redeploying the client," move to
> runtime module loading via **Module Federation** (`@module-federation/vite` or
> `@originjs/vite-plugin-federation`) or native **import maps**. This is more flexible but adds
> real complexity and a code-trust/sandboxing problem — defer until build-time activation is
> proven insufficient. Keep the plugin *contract* (§14.4) identical either way so the loader can
> change without rewriting plugins.

### 14.4 Plugin contract (the SDK)

Publish a shared package **`@camphoric/plugin-sdk`** that both the host and every plugin depend
on (host: regular dep; plugins: **peer dependency**, so all plugins share one host instance). It
exports the plugin interface, extension-point types, and host-provided context — this is the
single source of truth for the contract.

```ts
// @camphoric/plugin-sdk
export interface CamphoricPlugin {
  manifest: {
    name: string;            // === npm package name === Plugin.name
    version: string;
    displayName: string;
    description?: string;
    sdkVersion: string;      // semver range of @camphoric/plugin-sdk it targets
    surfaces: Array<'registration' | 'admin'>;
  };

  // JSON Schema for this plugin's per-event PluginEvent.data; the host renders it with the
  // existing rjsf form for the admin config UI, and the server validates against it.
  configSchema?: JSONSchema7;

  // called once per event activation, before contributions are used
  setup?(ctx: PluginContext): void | Promise<void>;

  // contributions (all optional) — merged into the host's extension points
  registrationFields?:  Record<string, RJSFField>;
  registrationWidgets?: Record<string, RJSFWidget>;
  adminSections?:       AdminSectionContribution[];   // nav entry + lazy component
  homeWidgets?:         DashboardWidget[];
  templateHelpers?:     Record<string, HandlebarsHelper>;  // for emails/reports
  reportRenderers?:     Record<string, ReportRenderer>;

  // lifecycle hooks (UX/side-effects only; never authoritative)
  hooks?: {
    onRegistrationChange?(formData: FormData, ctx: PluginContext): void;
    onRegistrationSubmitted?(result: ApiRegisterPaymentStep, ctx: PluginContext): void;
    onConfirmation?(ctx: PluginContext): void;
  };
}

export interface PluginContext {
  event: ApiEvent;
  data: unknown;                      // this plugin's PluginEvent.data (typed via configSchema)
  setData(patch: object): Promise<void>;  // persists to PATCH /api/pluginevents/:id/
  api: HostApiClient;                 // scoped, read-mostly access to host queries
  navigate(to: string): void;
  surface: 'registration' | 'admin';
}
```

Design notes:
- **Declarative contributions over imperative patching.** A plugin returns objects/components
  the host merges; it does not reach into host internals. This keeps the blast radius small and
  the contract stable.
- Plugin-contributed **registration fields/widgets** plug into the same rjsf registry described
  in §9.1 — a plugin field is just an rjsf field keyed by name, referenced from the event's
  `uiSchema`. This reuses all existing form machinery.
- Plugin **admin sections** appear as additional entries in the event-admin nav (§8.2), each a
  lazy-loaded component, scoped to that plugin's `data`.
- Plugin **template helpers** register into the Handlebars environment (§9.3) so reports/emails
  can use them.

### 14.5 NPM module organization

- **Naming:** scope plugin packages under `@camphoric/plugin-*` (matching the
  `@camphoric/plugin-sdk` package). `Plugin.name` in the DB equals the npm package name — one
  canonical identifier.
- **Package shape:**
  ```
  @camphoric/plugin-waiver/
    src/
      index.ts          # default export: the CamphoricPlugin object (+ manifest)
      configSchema.ts   # JSON Schema for PluginEvent.data
      fields/           # rjsf fields/widgets
      admin/            # lazy admin section component(s)
      helpers/          # handlebars/report helpers
    package.json        # peerDeps: react, @camphoric/plugin-sdk, @mantine/core, @rjsf/*
    tsconfig.json
    README.md
  ```
- **Dependencies:** keep `react`, `@camphoric/plugin-sdk`, Mantine, and `@rjsf/*` as
  **peerDependencies** so there's exactly one copy of each at runtime (avoids duplicate-React
  and duplicate-context bugs). Bundle only plugin-private code.
- **Build:** ship ESM with types; target the same module format as the host. Each plugin is
  independently versioned and semver-compatible with an SDK range.
- **Testing/dev:** provide a thin **host harness** (a Storybook-like sandbox or a dev route) so a
  plugin can be developed against the real extension points without the whole app.

### 14.6 Per-event configuration UX

- In admin, an event gains a **Plugins** management area (within settings or its own section) listing
  registry plugins with an on/off toggle → creates/updates the `PluginEvent` (`active`).
- When active, the plugin's `configSchema` is rendered with the **existing rjsf form** to edit
  `PluginEvent.data` — no bespoke config UI needed, and the server validates it against the same
  schema. This directly reuses §9.1/§9.5.

### 14.7 Recommended libraries

- **JSON Schema + the host's rjsf/ajv stack** for plugin config (render + validate) — reuse what
  the app already has rather than introducing a parallel system.
- **`zod`** (optional) for validating the plugin **manifest** and giving plugin authors typed,
  runtime-checked access to their own `data`.
- **`semver`** for host ↔ plugin/SDK compatibility checks at activation time.
- **`@module-federation/vite`** / **`@originjs/vite-plugin-federation`** *only if/when* moving to
  runtime (no-redeploy) loading (§14.3).
- A tiny typed event bus (**`mitt`**) or webpack's **`tapable`** if the hook surface grows beyond
  the simple `hooks` object — start without one.
- The host already provides **TanStack Query** (plugin data fetching), **Mantine** (UI),
  **Handlebars** (helpers), and **rjsf** (fields/config) — plugins consume these via the SDK and
  peer deps instead of bringing their own.

### 14.8 Versioning and compatibility

- The SDK is the contract; version it with **semver**. Each plugin's `manifest.sdkVersion`
  declares the range it supports; the host refuses to activate (with a clear message) on a
  mismatch.
- Breaking changes to extension-point types are SDK major bumps. Add new extension points
  additively (minor) so older plugins keep working.

### 14.9 Security and trust

- Build-time plugins run **in the host origin with full privileges** — treat installing a plugin
  as adding first-party code. Only install reviewed/trusted plugins; this is a deliberate
  constraint of the v1 model (and the main reason runtime third-party loading is deferred).
- **Server stays authoritative.** Plugins must not be trusted to compute prices or write money;
  any plugin-driven charge flows through existing server-validated endpoints. Lifecycle hooks
  are UX/side-effect only.
- Any HTML a plugin renders must go through the **sanitized** Template pipeline (§9.3); never
  `dangerouslySetInnerHTML` raw plugin output.
- The server validates `PluginEvent.data` against the plugin's `config_schema`; don't trust
  client-supplied plugin data shapes.

### 14.10 Open questions (plugins)

- **Build-time vs. runtime loading** — start build-time (recommended); define the trigger for
  investing in Module Federation/import-maps.
- **Server-side plugin code.** This section covers client extension; do plugins also need
  *server* hooks (pricing components, new endpoints, email behaviors)? If so, design a parallel
  backend plugin contract — significantly more involved, and a separate effort.
- **Plugin registry source of truth.** Is the client registry hand-maintained, generated from
  `package.json`, or seeded from the `Plugin` table at build time? Decide one.
- **Org-level vs. event-level plugins.** Some plugins may be licensed/enabled per organization;
  decide whether activation is purely per-event or also gated at the org level.
- **Ordering/conflicts.** If two plugins contribute to the same extension point (e.g. two fields
  with the same name, or competing report renderers), define precedence and conflict handling.

---

## 15. Decision Records

The body of this spec reads as plain specification. This section preserves *why* the notable
choices were made and the alternatives weighed, so a decision can be revisited with its
original context. The spec body states the decision; these records explain it.

### DR-1 — Server state via TanStack Query; client state via Zustand

**Decision:** Server data lives in TanStack Query; the only global client store is a small
Zustand store for the in-progress registration (§5).
**Context:** The previous client used Redux Toolkit + RTK Query, but almost all of its "state"
was cached server data behind a CRUD API. Splitting the concerns lets TanStack Query own
caching/refetch/invalidation (its query-key invalidation maps directly onto the old tag
invalidation), while genuine client state is small enough for Zustand. Augmented view models
(AugmentedRegistration/AugmentedLodging) are computed with memoized selectors over cached data,
independent of either library.
**Alternatives:** Stay on Redux/RTK Query (rejected: mostly server-cache ceremony for a
REST-CRUD app, with DevTools/time-travel weight that isn't needed); one store for everything
(rejected: conflates server and client state).

### DR-2 — Routing via TanStack Router

**Decision:** TanStack Router (§4).
**Context:** Admin selection state lives pervasively in the query string (`?registrationId`,
`?camperId`, `?reportId`, `?registrationsTab`), read in the old client through ad-hoc, untyped
helpers. TanStack Router provides typed, validated per-route search params and pairs with
TanStack Query (route loaders can prefetch/await queries).
**Alternatives:** React Router v7 — larger ecosystem and a near-trivial migration from the old
v5, but no first-class typed search params. Revisit if broad ecosystem/team familiarity comes
to outweigh the typed-search-param win.

### DR-3 — UI kit: Mantine (replacing React-Bootstrap)

**Decision:** Mantine (core + `@mantine/hooks`, `@mantine/dates`, `@mantine/modals`), with
`@tabler/icons-react` for icons.
**Context:** Move off Bootstrap 4 / React-Bootstrap. Mantine's component set maps cleanly to the
admin needs (Modal, Select, Table, Tabs, Popover, Alert, Badge, Tooltip, Loader) and ships
date-input and modal/notification helpers.
**Alternatives:** Stay on React-Bootstrap (rejected: dated, Bootstrap-4-bound). Icons:
`react-icons` is an equivalent alternative to `@tabler/icons-react` (minor). **Ant Design** was
reconsidered for the admin's data-grid direction (sortable/filterable tables); Mantine was kept
because forms are shared rjsf (one theme across both surfaces), the public registration surface
favors Mantine, and antd's Table advantage is matched by headless TanStack Table rendered with
Mantine primitives without a kit switch (see DR-19).

### DR-4 — Forms: rjsf + `@rjsf/mantine`

**Decision:** Keep React JSON Schema Form, on the official `@rjsf/mantine` theme, **rjsf v6**
(the latest major) (§9.1). `@rjsf/mantine` v6 requires **Mantine ≥8**, which sets the project's
Mantine major (§2, DR-24).
**Context:** The form engine drives both surfaces and is the highest-leverage component.
`@rjsf/mantine` is an officially supported rjsf theme (an earlier assumption that no official
Mantine theme existed was incorrect), so the base widgets come for free. The substantive work
is therefore: (1) the rjsf **v4 → v6 upgrade** — form props/types move to `@rjsf/utils`,
validation is supplied via a separate validator (`@rjsf/validator-ajv8`), custom templates pass
through a single `templates` prop (e.g. a templated `DescriptionFieldTemplate`), and the
`@rjsf/mantine` default `Form` is rendered with custom `fields`/`widgets`/`templates` merged in;
and (2) re-implementing the custom fields/widgets/templates (§9.1) on the new base.
**Alternatives:** A hand-built Mantine theme or driving rendering with `@mantine/form` +
a bespoke schema renderer (rejected: re-implements schema traversal, `$ref`/`definitions`,
conditionals, and array handling that rjsf already provides).
**Why v6:** build on the latest rjsf major (rather than v5) so the new client starts current.

### DR-5 — Dates via Luxon (replacing moment)

**Decision:** Luxon `DateTime` (§2, §10).
**Context:** moment is in maintenance mode. Luxon provides immutable values and explicit-zone
methods (`setZone`/`toISODate`/`toFormat`). Be deliberate about UTC vs. local boundaries — the
old lodging grid header rendered day labels at a fixed UTC offset to avoid off-by-one day
shifts; reproduce that intent rather than relying on the local zone. (Superseded for display by
DR-64: dates are shown in local time.)

### DR-6 — Drag and drop via dnd-kit (replacing react-grid-layout)

**Decision:** dnd-kit (`@dnd-kit/core` + `@dnd-kit/sortable`) for the lodging assignment grid
and camper reorder lists, with a custom day-width resize handle for stay bars (§8.6).
**Context:** The assignment grid needs cross-container drag (sidebar camper → leaf grid),
day-column snapping, and stay-bar resize. react-grid-layout bundled move + resize on a fixed
grid but is heavyweight and no longer the best fit. dnd-kit is maintained, accessible
(keyboard + pointer/touch), headless, and lighter; it covers drag + reorder with a grid-snap
modifier. It has no built-in resize, but since the grid is N equal day-columns, a small custom
pointer-events handle suffices.
**Alternatives:** Atlassian **Pragmatic drag and drop** — consider if the board ever needs
Trello-grade performance. **Avoid** `react-beautiful-dnd` (deprecated) and a fresh adoption of
`react-grid-layout`.

### DR-7 — Linting & formatting: ESLint + Prettier

**Decision:** ESLint v9 (flat config) + `typescript-eslint` (type-checked) + Prettier, with
`eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `@tanstack/eslint-plugin-query`, import
sorting, and `eslint-config-prettier` (§2).
**Context:** Chosen for the broadest, most mature **type-checked** rule set — backed by the real
TypeScript compiler, so type judgments match `tsc` exactly; rules like `no-floating-promises` /
`no-misused-promises` catch unawaited queries/mutations, the key failure mode in a
data-fetching-heavy app — and the richest plugin ecosystem (a11y, hooks exhaustive-deps,
TanStack Query). Cost: slower, more configuration, two tools.
**Alternatives:**
- **Biome** — a single fast Rust tool for lint + format, near-zero config. Note: Biome **v2 does
  support type-aware rules** (e.g. `noFloatingPromises`, `noImportCycles`, `noUnresolvedImports`)
  via its own opt-in "Scanner" that builds a module graph + inferred types — it does **not**
  invoke `tsc`. The gaps vs. `typescript-eslint` are breadth (a small, growing set vs. dozens of
  mature rules), fidelity (its own inference is an approximation, not the real compiler), and
  ecosystem (younger a11y ruleset, no TanStack Query plugin).
- **Hybrid (Biome format + ESLint lint)** — both strengths, but two toolchains.
Chosen ESLint for maturity; revisit (e.g. Biome) if build speed becomes a pain point.

### DR-8 — Editors: Monaco only

**Decision:** A single Monaco-based editor for all JSON/template/schema editing; drop
`vanilla-jsoneditor` (§9.6).
**Context:** The current app shipped both. Monaco edits JSON with schema validation and already
handles report templates, so standardizing on it cuts bundle size and concepts.

### DR-9 — Session, logout, and 401 handling

**Decision:** Add a `logout` action (`POST /api/logout`); a global handler bounces a 401 on any
admin endpoint back to the login form, preserving the attempted URL, and clears the cached user.
Public registration is anonymous and unaffected, but a 401/403 on submit surfaces a friendly
error (§6, §10).
**Context:** Login existed but there was no logout, timeout, or expired-session recovery.
Session auth + CSRF can expire server-side; the admin must recover gracefully.

### DR-10 — Error & notification strategy

**Decision:** Mantine `@mantine/notifications` toasts for mutation success/failure via a shared
TanStack Query `MutationCache.onError` (opt-out per call), plus inline field errors on forms
(§10).
**Context:** The old client surfaced errors ad-hoc (inline alerts/console). One consistent
mechanism across admin mutations and the registration/payment flow.

### DR-11 — Registration types: one canonical home

**Superseded by DR-32.** (Original decision: manage registration types in the registrations area
alongside invitations, not in Settings.)
**Decision:** Manage registration types in the registrations area, alongside invitations (§8.4)
— not in Settings (remove the stubbed editor there; §8.8).
**Context:** The current app exposed them in two places (one a stub). Co-locating with
invitations matches the actual workflow.

### DR-12 — Authorization granularity

*Superseded by DR-50 and DR-51: roles are enforced by the server and reflected in the UI.*

**Decision:** V2 keeps client auth simple — an authenticated-admin gate, with the **server**
enforcing per-object/org permissions. The UI renders only what the API returns (org/event lists
are already server-scoped) and surfaces 403s gracefully. Role-based UI gating from
`is_staff`/`groups` is deferred (§6).
**Context:** Avoids duplicating authorization in the client; the server is the trust boundary.
Revisit if the product needs an org-admin vs. super-admin UI distinction.

### DR-13 — Payment types per surface

**Decision:** The public flow offers Check / PayPal / Card; the admin Add-Payment modal also
records **Voucher** (and manual entries). This matches existing behavior (§7.2, §8.4).
**Context:** Voucher is a back-office reconciliation type, not a self-service option.

### DR-14 — Pricing-parity enforcement

**Decision:** A shared fixture set (inputs → expected `PricingResults`) committed once and run
against **both** `calculatePrice` (client, Vitest) and `calculate_price` (server, Django) in CI;
any pricing change must update both (§9.2, §11).
**Context:** Parity is a hard requirement (mismatched totals = wrong charge). A shared
golden-fixture suite is the durable guard against drift.

### DR-15 — Testing strategy

**Decision:** Vitest + React Testing Library (unit + component), with thorough unit coverage of
the pricing engine and template helpers, and one Playwright e2e over
registration→payment→confirmation. Type-check + lint + tests gate CI and pre-commit (§11).
**Context:** The spec previously had no testing target; this sets the floor.

### DR-16 — Data freshness & optimistic updates

**Decision:** Admin queries use a short `staleTime` (~30s) and refetch on window focus; the
registration config does not refetch on focus. Drag/reorder mutations (lodging assignment,
camper `sequence`) are optimistic with rollback on error; other mutations invalidate-and-refetch
(§10).
**Context:** Snappy board/reorder UX without stale admin data, and the registration form must not
refetch its config mid-edit.

### DR-17 — Responsive / device targets

**Decision:** Public registration is mobile-first (usable to ~360px); admin is desktop-optimized
(≥1024px), usable-but-not-optimized on tablet, not designed for phones (§11).
**Context:** Registrants are often on phones; organizers work at desks. Effort goes where each
audience is.

### DR-18 — Localization & currency

**Decision:** English/USD only; i18n and multi-currency are explicit **non-goals** for V2 (§1).
**Context:** No current multi-language/currency requirement, and PayPal/formatting assume USD.
Recorded as a non-goal so it isn't silently assumed in scope.

### DR-19 — Admin data tables: headless TanStack Table + Mantine primitives

**Decision:** Use headless **`@tanstack/react-table`** rendered with Mantine `Table` primitives
for sortable, filterable, paginated admin tables — the registrations, campers, and invitations
lists (§8.2, §8.4, §8.5). Sort/filter/pagination run **client-side** over the full per-event
dataset (small at this scale — DR-25), with the URL-addressable bits (selection, and table state
as it's wired) held in TanStack Router search params.
**Context:** The admin is gaining real data-grid needs (sorting/filtering, and converting the
two largest lists to tables). This is a component-level need met *within* the chosen stack:
TanStack Table composes natively with TanStack Query (which fetches the per-event set) and
TanStack Router (table state as typed search params — the admin URL-as-state pattern, DR-2). It
does **not** justify switching UI kits — see DR-3. The turnkey wrapper `mantine-react-table` was
the original choice, but its stable line requires Mantine v6 and its v2 beta targets Mantine v7;
neither supports the Mantine **v8** this client runs on (DR-4). The headless library — the lean
fallback named below — has no Mantine peer constraint, so it's the realized choice; the extra
wiring (column defs, a small reusable `DataTable`) is modest.
**Alternatives:** `mantine-react-table` (turnkey, but Mantine ≤7 only — incompatible with our
v8, the reason it was dropped). **Ant Design Table** (turnkey, but would mean an antd kit switch
with the rjsf/public-surface costs in DR-3, rejected). `match-sorter` (DR-20) handles lightweight
client-side filtering on smaller lists.

### DR-20 — Client-side search: match-sorter (replacing fuse.js)

**Decision:** Use `match-sorter` for lightweight client-side filtering/ranking of smaller admin
lists, and `@tanstack/match-sorter-utils` for the data tables' fuzzy column/global filtering
(§2, §9.4). Data-heavy lists filter in the data table (DR-19), client-side at this scale (DR-25).
**Context:** fuse.js was serviceable but no longer the clear best once its role shrank (big lists
moved to the data tables' own filtering) and TanStack Table entered the stack — TanStack Table's
fuzzy filter is already `match-sorter`-based. Standardizing on `match-sorter` gives one
filtering algorithm across tables and lists, a lighter dependency, and more predictable ranking
for short labels (names/titles): starts-with → word-starts-with → contains → acronym → fuzzy.
**Alternatives:** **fuse.js** (object-keys-with-weights API, but bitap ranking is less intuitive
on short labels; rejected for consistency). **uFuzzy** — faster and more typo-tolerant for large
client-side sets, but a lower-level API; adopt only if heavy typo-tolerant fuzzy is needed.
Full-text engines (FlexSearch/MiniSearch/Orama) are overkill for these list sizes.

### DR-21 — CSV parsing: d3-dsv (replacing papaparse)

**Decision:** Use `d3-dsv` (`csvParseRows`) to parse server-produced CSV report output into rows
for the table preview (§2, §8.7).
**Context:** The CSV is generated server-side (Jinja → CSV) and parsed client-side only to
preview it as a table; the download uses the raw string and needs no parser. papaparse's
streaming/web-worker/auto-delimiter machinery is therefore unused. `d3-dsv` is a smaller,
RFC-4180-correct parser (handles quoted commas/newlines) that fits this bounded
parse-a-string-for-display use.
**Alternatives:** **papaparse** (robust and ubiquitous, but heavier than needed here; fine to
keep if its edge-case coverage/streaming is later wanted). Naive `split(',')`/`split('\n')`
(**rejected** — silently corrupts quoted fields, the bug in the old client).

### DR-22 — Drop lodash and react-helmet

**Decision:** No `lodash` and no `react-helmet`. Use optional chaining for property access;
`@mantine/hooks` `useDebouncedValue`/`useDebouncedCallback` for debouncing (e.g. the form's
localStorage save) and `useDocumentTitle` for the page title. Reach for `es-toolkit` (a modern,
smaller, TS-native lodash alternative) only if a utility belt is genuinely needed (§2).
**Context:** lodash's uses here are just `get` and `debounce`, both covered by native syntax and
Mantine hooks the app already depends on. react-helmet is effectively unmaintained and was used
only to set the document title — `useDocumentTitle` (or a TanStack Router route `head`) replaces
it and drops the dependency entirely.
**Alternatives:** `lodash-es` (tree-shakeable, but still unnecessary here); `react-helmet-async`
(maintained fork, but more than needed for just a title).

### DR-23 — Address autocomplete: Places API (New)

**Decision:** Use Google's **`PlaceAutocompleteElement`** (Places API "New") with
`@types/google.maps`, injected at runtime when an API key is configured (§2, §9.1).
**Context:** The legacy `google.maps.places.Autocomplete` and the `@types/googlemaps` package are
both deprecated; the current supported surface is `PlaceAutocompleteElement`. Build on the
non-deprecated API. The field stays optional (no key ⇒ plain address inputs).
**Alternatives:** legacy `Autocomplete` (deprecated, rejected); third-party wrappers like
`use-places-autocomplete` (an extra dependency, unnecessary).

### DR-24 — Styling: Mantine CSS Modules + PostCSS (replacing Sass)

**Decision:** Style with Mantine's approach — CSS Modules + PostCSS (`postcss-preset-mantine`,
which provides Mantine's mixins/variables) — rather than Sass (§2).
**Context:** The current client uses Sass. Mantine (v7 and v8) is built around CSS Modules +
PostCSS; adopting it keeps styling consistent with the component library, drops the Sass
toolchain, and provides Mantine's responsive/color-scheme mixins. Component-scoped styles avoid
global leakage. The project tracks Mantine **v8** (required by `@rjsf/mantine` v6 — DR-4); the
styling model is unchanged across the two majors.
**Alternatives:** Sass/SCSS (works, but a parallel styling system to Mantine's; dropped).
CSS-in-JS (Mantine moved away from it in v7 for performance).

### DR-25 — Admin list scale: client-side (no server-side paging in V1)

**Decision:** Admin data tables (registrations, campers, invitations) fetch the **full per-event
dataset** (scoped by the existing `?event=` filter) and do sort/filter/pagination **client-side**
in `mantine-react-table`. No server-side ordering/pagination is added for V1 (§2, §8.2, §9.4,
DR-19).
**Context:** The largest per-event dataset is campers, at **~500–700 records**; registrations are
fewer and invitations smaller. A few hundred rows are trivial for client-side sort/filter/paging,
and computing the augmented view models (§5) over the full set is fine at this size. This also
avoids adding DRF `OrderingFilter`/pagination params to the API — a backend change the client
can't make on its own.
**Measured** (a real production event's completed-registration campers, `GET /api/campers/?…`):
**497 campers ≈ 535 KB raw JSON, ~60 KB gzipped** over the wire; per record ~1.1 KB avg /
1.55 KB max — uniform, with no outlier records or large blobs (heaviest fields: `attributes`
~390 B/record, then `server_pricing_results` and `stay`). Extrapolated to the 700 upper bound:
≈ 755 KB raw / **~85 KB gzipped**. That is fetched once and cached by TanStack Query, parses in
milliseconds, and renders through the table's row virtualization — comfortably fine; no
pagination needed.
**Alternatives:** Server-side sort/filter/pagination via TanStack Query — the escalation path
only if events ever grew an order of magnitude larger (many thousands of records; would require
new list-endpoint params and a backend change). Even then, a lighter list projection is
preferable to pagination.

### DR-26 — Proactive session monitoring & in-place re-auth (admin)

**Decision:** On the admin surface, proactively detect session expiry and keep an active session
alive: check session validity (via the whoami endpoint, `GET /api/user`) on window **focus**, on
**throttled user activity**, and on a **regular interval**, treating that traffic as keep-alive.
When the session has expired, present an **in-place re-authentication** affordance (e.g. a modal
login over the current screen) and resume in context on success, preserving in-progress edits.
The reactive 401-bounce-to-login (DR-9) is the fallback (§6).
**Context:** Admin sessions (Django session auth) can expire while an organizer is working;
discovering that only when a save fails — and losing the edit — is a poor experience. Proactive
checks plus keep-alive keep an active user logged in, and in-place re-auth avoids losing work or
navigating away. The public registration flow is anonymous and unaffected.
**Backend dependency:** a cheap session/identity check (whoami already exists) and session
keep-alive config — Django `SESSION_SAVE_EVERY_REQUEST = True` with an appropriate
`SESSION_COOKIE_AGE`, so each request (including the checks) slides the expiry (Appendix A).
**Alternatives:** Reactive-only (DR-9) — simpler, but surprises the user and risks lost edits.
Token/JWT refresh — a larger auth change, unnecessary given session auth.

### DR-27 — API types: explicit exported module (not ambient globals)

**Decision:** Define the API entity types (§5) as explicit, `export`ed TypeScript types in a
dedicated module (e.g. `api-types.ts`) that callers import — not as ambient `declare global`
interfaces (the current `global.d.ts` approach). For V1 they stay hand-maintained and must track
the backend serializers.
**Context:** Ambient globals are convenient but pollute the global namespace, hide where a type
comes from, and invite drift. An imported module fixes discoverability and tooling immediately,
with **no backend change** — so it's in scope for V1.
**Future / alternatives:** The better long-term answer is to **generate** these types from a
backend OpenAPI schema (`drf-spectacular`) via `openapi-typescript`, wired into CI so they can't
drift (with `@extend_schema` annotations for the bespoke register/payment/report endpoints, and
JSON fields landing as `unknown`). This needs a `server/` change, so it's deferred and tracked in
`TODO.md`. Generators that also emit TanStack Query hooks (`orval`, `@hey-api/openapi-ts`) are an
option if hand-rolled hooks become a burden; optional Zod output adds runtime validation.

### DR-28 — Test-as-you-go (tests land with each feature)

**Decision:** Tests are written incrementally, in the same change as the code they cover, rather
than batched into a dedicated testing phase. Pure logic gets unit tests; components get component
tests; the cross-cutting suites (pricing parity, the Playwright e2e) grow as their surfaces are
built. A behavior change isn't done until its tests exist and pass (§11).
**Context:** DR-15 set the test *stack and targets* but not *when* tests get written; the build
order (Appendix B) could be read as "tests come at the hardening phase." Deferring tests lets
regressions accumulate and lets the highest-leverage logic (pricing, the form engine) go
unverified while it's being built — exactly when tests catch the most. Writing them alongside the
code keeps each phase shippable and the quality gates meaningful from the first feature.
**Tooling:** unchanged from DR-15 — **Vitest** is the runner (it reuses the app's Vite
transform/aliases, so there's no parallel Jest/Babel config to maintain) with React Testing
Library for components and Playwright for the one e2e. This DR is about cadence, not stack.
**Alternatives:** A dedicated end-of-build testing phase (rejected: defers feedback to when it's
least useful and least likely to happen); a strict TDD mandate (not required — the rule is that
tests ship *with* the feature, not necessarily *before* it).

### DR-29 — Custom form widgets/templates scoped to what the v6 theme lacks

*For array fields, superseded by DR-49: the theme's array template doesn't cover what it was
assumed to.*

**Decision:** Only re-implement the form widgets/templates whose behavior the official
`@rjsf/mantine` v6 theme does **not** already provide. The custom widget layer is therefore just
**PhoneInput**, **NaturalNumberInput**, and a **maxLength-truncating Textarea**; the one custom
template is the templated **DescriptionFieldTemplate**. Select, Checkboxes, integer/datalist text
inputs, and the Field/Object/Array templates come from the base theme (§9.1).
**Context:** The v4 reference (React-Bootstrap, rjsf v4) hand-built a long list of widgets and
templates — Checkboxes, Select, Text, Textarea, and Field/Object/Array templates — because its
base theme didn't cover them. Inspecting `@rjsf/mantine` v6 shows the base now provides those:
its `SelectWidget` supports disabled options + value coercion, `CheckboxesWidget` supports
inline + disabled options, `BaseInputTemplate` handles integer (`NumberInput`) and datalist
examples, and uiSchema options cover content-wrapper classes and array add/remove labels.
Re-implementing them would duplicate the theme for no behavior gain and add maintenance surface.
This realizes DR-4's premise ("the base widgets come for free") concretely.
**Alternatives:** Port the full v4 widget/template set 1:1 (rejected: redundant with the theme,
more code to maintain, and diverges from the supported theme's accessibility/behavior). Revisit
per-widget only if a base widget proves insufficient for a specific event configuration.

### DR-30 — Phone input: react-international-phone (replacing react-phone-number-input)

**Decision:** Implement the phone widget with **`react-international-phone`** — its
`usePhoneInput` hook composed with a Mantine `TextInput` and the library's flag `CountrySelector`
as the input's `leftSection` — rather than `react-phone-number-input` (§2, §9.1).
**Context:** Both give an international phone field with a country picker and an E.164 value.
`react-phone-number-input` hard-depends on `libphonenumber-js` (~75–145 KB depending on metadata)
and renders its own non-Mantine input with its own stylesheet — weight and a styling mismatch
that matter on the **mobile-first, bundle-sensitive registration surface** (§11). The original
client used it. `react-international-phone` is markedly lighter (no mandatory `libphonenumber-js`;
it formats via per-country masks), is TypeScript-native, and — via `usePhoneInput` — composes
with native Mantine inputs for consistent styling and accessibility. Strict per-country
*validation* (if ever needed beyond the server's) can add `libphonenumber-js` on demand.
**Alternatives:** `react-phone-number-input` + `libphonenumber-js` (heavier, non-Mantine input;
rejected for the registration bundle). A Mantine `TextInput` + `react-imask` US mask (lightest,
but US-only, no country picker/validation — only worth it if phone is treated as US-only, which
the spec's "international" intent rejects). Hand-rolling on `libphonenumber-js` (same weight as
the rejected option, more code).

### DR-31 — Playwright e2e: static-Storybook component suite + mobile projects

**Decision:** The Playwright e2e suite has two parts. The **component e2e** drives the
**Storybook stories** (the form engine, templating pipeline, data table, and admin widgets)
served from a **static `storybook build`** (not the dev server; the workbench was Ladle when this
was decided — DR-59). A **registration-flow smoke** drives the Vite dev
server (which proxies to the Django backend) and skips gracefully when the registration config
can't load, so it stays green without a backend and never submits (creates no data). Every test
runs across three projects — **Desktop Chrome, Mobile Chrome (Pixel 5), Mobile Safari
(iPhone 13)** — exercising layouts responsively (DR-17).
**Context:** The stories already exercise the real components through their providers, so
they're the natural e2e render targets (DR-7) — no backend, fast, deterministic. Driving the
workbench's **dev** server proved flaky: Vite's on-demand per-story compile and dep-optimization reload made
story loads race the assertions under parallel workers. Serving a **static build** removes
compilation from the hot path entirely, so the suite is fast and stable in parallel. The
registration smoke covers the one genuinely end-to-end public path (load → live pricing →
interact) without the fragility (or data mutation) of a full submit against a shared backend.
**Alternatives:** Driving the dev server for everything (flaky compile races; rejected). A full
registration→payment→confirmation submit e2e (mutates the shared dev backend and needs PayPal
sandbox wiring — deferred to a seeded test backend). Cypress (heavier, no first-class multi-device
projects; the stack is already Playwright-friendly).

### DR-32 — Registration types managed in Settings (supersedes DR-11)

**Decision:** Manage registration types (create/edit name, label, invitation email
subject/template) in **Settings** (§8.8), alongside the event's other configuration. The
Invitations area (§8.4) only *consumes* the types — choosing one when inviting — and points to
Settings when none exist yet.
**Context:** Registration types are event configuration, not per-invitation workflow: they're
edited rarely and belong with the schemas/pricing/admin-attribute config already in Settings.
Co-locating with invitations (DR-11) split configuration across two areas and cluttered the
invitation-tracking view. Settings is the natural canonical home now that it holds all other
event configuration.
**Alternatives:** Keep them with invitations (DR-11 — mixes config with workflow). Expose in both
places (the original app's mistake — two homes, one a stub; rejected in DR-11 and still rejected).

### DR-33 — Registration review on the payment step is schema-driven

**Decision:** The payment step's "Review registration" (§7.2) is generated from the form's
`dataSchema`/`uiSchema` and the entered data, using rjsf's own schema resolution
(`retrieveSchema`) to expand `$ref`s, `dependencies` and `if/then` against the data. Per-section
pricing summaries come straight from `serverPricingResults`, labeled from the pricing logic,
leaving out components that come to exactly $0 (the totals always show; negative amounts stay).
**Context:** Events define arbitrary registration and camper fields, so the review can't be a
fixed layout. The same schema that rendered the form already carries titles, `enumNames` and
conditional structure; reusing it (and the same resolver the form engine uses) keeps the review
in lockstep with the form for every event with no per-event configuration. A per-event review
template would be a second thing to author and would drift from the schema.
Events define many optional components (add-ons, per-camper extras, the handling fee when
paying by check) that are $0 for most registrations; listing them buried the real charges (#666).
**Alternatives:** A per-event Handlebars/Jinja "review template" (extra authoring, drifts).
Dumping the raw form data (unreadable enum codes and keys). Re-rendering the form read-only
(rjsf's `readonly` mode keeps widget chrome and empty fields, and is far noisier than a rundown).
Hiding $0 lines in the admin's fee breakdown too — the admin keeps them, since a registrar may
want to see or override one (DR-56).

### DR-34 — Per-event validation messages as a path-keyed lookup

**Decision:** Each event stores its validation messages as a separate JSON field,
`registration_error_messages`, keyed by field path (array positions as `*`) and then by ajv
keyword, with Handlebars message templates and an event-wide `*` default (§7.1). The form
applies them inside its validator — wrapping `@rjsf/validator-ajv8` so each validation pass's
errors are resolved against the data being validated — and rewrites both the inline `message`
and the error list's `stack`. Summary errors from failed conditional branches, and duplicates,
are blanked rather than removed. The Settings editor (§8.8) offers fields from the registration
form's full schema as served to registrants.
**Context:** A registrant who picked a non-final lodging option ("RV Camping" without a length)
saw only "must have required property 'id'": the error list showed ajv's raw text (a transformer
had only rewritten `message`, which the list doesn't display), and the lodging picker showed no
error at all. Events needed their own wording for such cases. The lodging schema is built by
the server rather than stored with the event, so messages can't live inside the event's JSON
Schema; a path-keyed table covers server-built and conditional fields alike, and keeps all of an
event's wording in one editable place. rjsf validates before the parent receives `onChange`, so a
`transformErrors` prop closing over `formData` would see the previous keystroke; the validator
receives the current data. Errors must stay in the list for rjsf to block submission, so noise is
hidden by blanking its text. The stored `registration_schema`/`camper_schema` lack the
server-built lodging fields, so the editor reads the served form schema instead.
**Alternatives:** An `errorMessage` keyword inside the JSON Schema (ajv-errors) — can't reach
server-built fields, and scatters wording across schemas. A per-field `ui:errorMessages` in the
uiSchema — rjsf has no such option, and a table is easier to review and edit as a whole.
Hard-coded client messages — no per-event wording. Registration-type (invitation) overrides of
the messages — deferred; they can later be merged like the schema overrides.

### DR-35 — Server-built, read-only template variables

*The API default this describes (legacy reports) changed in DR-40.*

**Decision:** A new kind of report renders from variables the server builds itself
(`variables_source: 'server'`, §8.7), alongside the legacy kind whose variables the client
uploads. The server builds a relationship-resolved model of the event in a fixed number of
queries: typed, plain-data objects (`event`, `registration`, `camper`, `lodging`, `payment`, …)
linked to each other (`camper.registration`, `camper.lodging`, `lodging.all_campers`), with
decimal money, real dates, and derived fields such as `event.nights` and `lodging.full_name`.
The objects are read-only to templates. Legacy reports stay the API default and keep working;
they move over one at a time.
**Context:** To render a report, the client built the whole event (six queries plus
augmentation) and posted it; Camp Harmony's bundle was about 10 MiB and hit request-size limits.
Templates had to join data through string-keyed lookups (`lodgingLookup[camper.lodging|string]`)
and mutate objects with `.update()`. The server already has the data, and one clean model can
serve reports and emails alike. Read-only objects mean one template can't corrupt the data
another part of the same render sees, while templates can still build their own lists and
dicts. Keeping the legacy path avoids rewriting the 62 existing `data/` reports at once.
**Alternatives:** Keep posting the bundle but compress or trim it — still slow, still
lookup-based. Expose the legacy camelCase bundle shape from the server — keeps the awkward
lookups. Pass Django model instances — lazy queries per access, and model methods (`delete`,
`save`) reachable from templates. Convert every legacy report in one go — too much risk at once.

### DR-36 — Editor language services driven by the server's variable spec

**Decision:** The server publishes a machine-readable **variable spec** (the describe endpoint,
§5), generated from one Python registry plus the event's own schemas and pricing, and the
template editor's autocomplete and hover are computed from it on the client (§9.6). Jinja
highlighting is a custom Monarch tokenizer (`camphoric-jinja`), adapted from Monaco's twig
language without its HTML rules. Completion and hover providers are registered once per Monaco
instance and look up each editor's spec and context by its model URI. The completion logic —
working out what's being typed, the scope of loop/assignment variables, and the type of an
expression through fields, subscripts and list filters — is plain functions, unit-tested apart
from Monaco. Registry tests on the server keep the spec equal to what the renderer passes.
**Context:** Template authors had no autocomplete, no help and no preview. The server knows
exactly what each kind of template receives, including each event's own form questions, so
publishing that is the only way suggestions can be both accurate and event-specific. One spec
also feeds the help surfaces. Monaco has no Jinja language; twig's tokenizer assumes HTML
templates, while Camphoric's are mostly CSV, markdown and text.
**Alternatives:** A Jinja language server (e.g. via a worker) — heavy, and it still wouldn't
know Camphoric's variables. Inferring variables from a sample render's output — no types or
docs, and misses empty collections. Hand-maintained client-side type definitions — drift from
the server. Monaco's twig or handlebars modes — wrong syntax details and HTML-oriented.

### DR-37 — Sandboxed Jinja with limits and structured diagnostics

**Decision:** All server-side Jinja — new reports, and legacy reports — renders in Jinja's
sandboxed environment. The new environment also blocks mutating methods on Camphoric objects,
renders `None` as blank, and removes `lipsum`; the legacy environment stays mutable (legacy
templates rely on `.update()`), so it behaves as before apart from the sandbox. Renders have a
time limit and an output-size cap (reports 20 s / 10 MB, previews 5 s / 2 MB, emails 3 s /
512 KB). Every failure is returned as a structured diagnostic with its line (and column where
it can be found); tracebacks are logged, never returned. Misspelled fields on Camphoric types
render blank and are reported as warnings. `manage.py check_templates` renders or parses every
saved template, and CI runs it after importing the live event data.
**Context:** The report environment wasn't sandboxed, so a template could reach Python
internals. Admins write templates, but they shouldn't be able to run code on the server, and a
runaway loop shouldn't tie up a worker. An editor can only mark problems in the text if it
knows their lines; a raw traceback is unreadable to a template author. Jinja renders undefined
fields as blank, which hides typos; a warning keeps the lenient output but tells the author.
Checking the imported templates in CI catches breakage from changes to the model or the sandbox.
**Alternatives:** A strict undefined that fails on any missing value — breaks templates that
rely on blank output for missing optional answers. A separate render process per template —
stronger isolation but much slower. Leaving the legacy environment unsandboxed — keeps the hole
open.

### DR-38 — Emails move to Jinja, per template, with a report when one can't render

*The API default this describes (Mustache) changed in DR-40. The per-template engine is gone
since DR-45: every email is a Jinja email template; the failure report stands.*

**Decision:** The confirmation and invitation emails can be written in Jinja against the same
server-built variables as reports (DR-35). Each template records its engine
(`confirmation_email_engine`, `invitation_email_engine`: `mustache` | `jinja`), defaulting to
`mustache` at the API so existing events, the importer and the v1 client are unaffected; the v2
client creates new registration types in Jinja. Jinja emails render their subject too. A Jinja
template that doesn't parse can't be saved. If a Jinja confirmation email can't be rendered when
a registration completes, the registration still completes, the registrant is sent nothing, and
a report with every problem is emailed to the event's `confirmation_email_from` address; a Jinja
invitation that can't be rendered is refused with a 400 and not sent.
**Context:** Emails used Mustache with thin, hand-built variables (camper attributes flattened,
lodging as `'none'`), no subject templating, and no preview. A per-template flag lets each email
move when it's rewritten, and lets the `data/` emails be converted and checked before the
defaults change. A confirmation email with a hole in it (a blank name or total) is worse than
none — the registrant can't tell what's missing — so the organizer is told instead, with enough
detail to fix the template and follow up; failing the registration would lose a completed
payment. Parse errors are caught at save time because they break every email; problems that
depend on the data can only show when rendering, which is what the preview and
`check_templates` cover.
**Alternatives:** Convert every email at once with one switch — riskier, and events differ.
Send the registrant whatever rendered — can send a misleading email. Fall back to the old
Mustache template on error — there may not be one, and two templates drift. Block saving on any
render problem for the sample — samples can't cover every registration.

### DR-39 — Bulk-email recipients chosen by expressions, sent by a background command

*Superseded by DR-44 and DR-45: group email templates, with recipients chosen by conditions (and
an optional expression), are sent in batches through the outbox; the task-based bulk email and
its background command are removed.*

**Decision:** A bulk email's recipients are built from the event's registrations or campers
(or a typed list): a Jinja filter expression chooses them and Jinja expressions give each one's
address and name, with defaults. Every candidate is either a recipient or skipped with a reason
(no address, invalid, duplicate, expression failed), shown before sending. The list is rebuilt
from the current data at each send, keeping rows already sent, so a resumed or repeated send
never double-sends. Each copy renders against the event graph (DR-35), built once per run. The
v2 client sends in the background: the send endpoint starts `manage.py send_bulk_email` in its
own process and returns at once, and the client polls the task. Tasks whose recipients were
added directly through the API keep working as before.
**Context:** Bulk email had sending machinery but no way to choose recipients short of creating
them one by one, and its Mustache body only knew the recipient's address (#654). Expressions
reuse what template authors already write, so "everyone who owes money" is
`registration.balance > 0` rather than a new filter language. Showing who's skipped and why
catches missing or duplicate addresses before anything is sent. A long, rate-limited send in a
web request would tie up (and could be killed with) the worker; a separate process outlives
the request, and the existing run fields let the client follow and cancel it.
**Alternatives:** A Jinja template that outputs the recipient list as CSV (the 2024 WIP) —
flexible, but hard to validate per recipient or explain what was skipped. A structured filter
builder — friendlier for simple cases, but a second language that can't express everything the
variables allow. A task queue (Celery, RQ) — more infrastructure than one command needs.
Freezing the list when the email is composed — misses people who register before it's sent.

### DR-40 — Jinja and server variables become the defaults

*For emails, superseded by DR-45: there's no engine to default any more.*

**Decision:** The `data/` confirmation and invitation emails are converted to Jinja, and the API
defaults flip: new email templates (event confirmation, registration-type invitation, bulk
email) default to `jinja`, and new reports to `variables_source: 'server'`. Existing rows keep
what they were saved with — only the defaults change. The importer sends the engine for its
emails, and marks its reports `client` unless a report says otherwise, since the 62 `data/`
reports are still written for the browser bundle. Each converted email was checked with a
temporary comparison tool (since removed; it remains in the project history), which rendered the
saved Mustache and the candidate Jinja for every registration and invitation of the live-import
events and diffed them after normalizing the differences the conversion is meant to make (HTML
entities, dollar formatting, insignificant whitespace).
**Context:** DR-35 and DR-38 kept the legacy behavior as the default so existing events, the
importer and the v1 client weren't affected until the `data/` emails were converted. With them
converted and verified, new templates should get the model that has autocomplete, preview,
checks and a failure report; keeping Mustache as the default would leave any new API client on
the thin, unchecked path. The deployed image serves only the v2 client, which always sends the
engine and variables source. The conversion also fixes the emails' visible Mustache quirks:
amounts print as `$1,234.50` rather than `$1234.5`, text emails no longer contain HTML entities,
lodging reads `Cabins, Cabin 4` without the root's name, and lists no longer start with a stray
comma.
**Alternatives:** Keep the legacy defaults indefinitely — new API clients would keep creating
templates with the weaker model. Change existing rows' engines in a migration — the saved text
is Mustache and would break. Convert the reports too — out of scope (DR-35); they move one at a
time. Byte-for-byte equivalent output — would mean reproducing the Mustache quirks in Jinja.

### DR-41 — The data/ reports are converted to Camphoric variables, checked against the old output

**Decision:** Every report under `data/` (Harmony, Lark, the Jughandle Campout and Family Week,
74 in all, including the Handlebars ones) is rewritten as a Camphoric-variables Jinja report: plain
Jinja over the server's objects, with no lookup tables, no changes to Camphoric objects (own lists,
dicts and `namespace` instead), and camp dates from `event.nights`/`event.start` instead of
hardcoded lists. Handlebars reports become markdown reports. Each conversion was rendered
alongside the legacy report on the same data and compared: the legacy variables were built by the
client's own code (`store/augmented.ts`) and Handlebars reports rendered by the client's own
Handlebars helpers, and the test data was enriched (varied stays, answers, admin fields,
registration types, payments, registration dates), always inside a rolled-back transaction. The
outputs match, except for listed fixes: crashes (sorting on missing values, missing lodging or
answers), wrong totals, stale references whose intent was plain (fields that moved, renamed
registration types, dates that meant the camp's first day). Unclear stale references are kept and
marked `TODO` in the templates. The comparison tools were temporary and were removed once the
conversion was accepted (they remain in the project history).
**Context:** The legacy reports needed the browser to build and upload the whole event (#653)
and mutated the uploaded data to join it. New events are created from `data/`, so converting
those files moves every future event onto the new model. Comparing against the legacy output,
rather than reviewing the rewrites by eye, is what makes 74 rewrites trustworthy; building the
legacy variables with the client's own code avoids a second implementation that could agree with
a mistake. The live-import test data leaves most branches unexercised (no stays, admin fields or
registration types), hence the enrichment.
**Alternatives:** Keep the legacy reports and a server-built copy of the legacy bundle — a
permanent shim over the old, lookup-based shapes. Convert the reports without comparing — too
easy to change a total silently. Convert the reports saved in live events too — out of scope for
now; the same tools would do it, and are recoverable from history.

### DR-42 — The confirmation page renders on the server

**Decision:** The event's confirmation page is a Jinja markdown template rendered on the server
when a registration completes, with the confirmation email's variables. The payment step returns
the rendered markdown (`confirmationPage`) and the client only displays it, through its
sanitizing markdown pipeline. This replaces the Handlebars template the client used to render
with the variables it held (`paymentInfo`, `pricing_results`, …); it is a breaking change with
no compatibility path: an existing event's Handlebars page must be rewritten in Jinja (until it
is, registrants see the generic thank-you and the organizer is sent the problems). A page that
doesn't parse can't be saved. The `data/` pages are converted (their output checked against the
Handlebars version for the test registrations; amounts now print as `$1,234.50`).
**Context:** The page said the same things as the confirmation email with a different engine
and different variables, and could only use what the browser happened to hold. Rendering it on
the server gives it the whole registration (campers, lodging, pricing, payments), the same
autocomplete, help, preview and checks as the email, and one variable model for everything
organizers write. A broken page shouldn't block a completed registration, so it falls back and
reports, like the email.
**Alternatives:** Keep Handlebars with an engine flag per event, as the emails did — not needed:
the user chose a breaking change, and the few live events are re-imported each season. Send
rendered HTML — the client already sanitizes and styles markdown for every other message.

### DR-43 — Tests, stories and fixtures live in per-folder `test/` directories

**Decision:** Each source folder keeps its `*.test.ts(x)`, `*.stories.tsx` and fixture files in a
`test/` subdirectory (e.g. `pricing/test/calculatePrice.test.ts`) rather than beside the code.
Vitest (`src/**/*.test.{ts,tsx}`) and Storybook (`src/**/*.stories.tsx`) find them by glob,
and a story's id comes from its meta title (DR-59), not its path, so the e2e suite's story URLs
are unaffected.
**Context:** With tests and stories beside every component, folders were twice as long and the
production modules were harder to pick out. A `test/` directory per folder keeps them near the
code they cover (the DR-28 intent) while separating them from it.
**Alternatives:** Co-locate beside the code (the previous layout) — noisy folders. A single
top-level `src/test/` tree mirroring `src/` — the tests drift away from the code and every move
has to be made twice.

### DR-44 — All email goes through one outbox, delivered by a task worker

**Decision:** Every outgoing email (confirmations and their problem reports, invitations, group
email and tests) is queued as a row in an email outbox, rendered when it's queued, and delivered
in the background by a worker process. The row is the permanent record of what was sent, to
whom, from which account, and how delivery went. Delivery retries temporary failures with
backoff and keeps to each sending account's per-minute and per-day limits. Requests no longer
wait on the mail server: the payment step and the invitation endpoint return once the email is
queued. The worker runs on Django's Tasks API with a database-backed queue (`django-tasks-db`);
the outbox row, not the task, decides what gets sent, so a task that runs twice or late can't
send twice.
**Context:** Email was sent inside web requests: a slow mail server delayed registration, a
dropped connection turned a completed registration into an error, a retried payment request
could send a second confirmation, nothing was retried, and nothing recorded what was sent. Bulk
email ran in an unsupervised subprocess. Gmail-style daily sending caps make pacing a correctness
issue, not only a nicety.
**Alternatives:** A Postgres outbox with a hand-written worker loop — viable, but the Tasks API
gives the same design a standard interface and a maintained worker. Celery or RQ with Redis — more
moving parts than Camphoric's volume needs. Procrastinate — capable, but needs psycopg 3. Keep
sending in the request and add retries there — still ties registration to the mail server.

**One connection per chunk (addition):** Having sent its message, a delivery keeps the SMTP
connection open and sends the sending account's other due messages over it — the most urgent
kind first, each claimed and checked against the account's limits like any other — up to 50
messages or two minutes, stopping at a limit or after a failed send. The other messages' own
wake-ups then find nothing to do. A group email to a few hundred people signs in to the mail server
a few times instead of once per message, which is faster and looks less suspicious to providers
such as Gmail. A separate task per chunk was the alternative; reusing the per-message wake-up keeps
one delivery path, and a message's row still decides whether it's sent.

### DR-45 — Every email is an email template, in Jinja

**Decision:** The registration confirmation and each registration type's invitation are stored as
email templates (`EmailTemplate`, with a `purpose`), linked from the event and the type and
created with them, alongside the templates for emails sent to groups. All of them are Jinja; the
Mustache engine is removed. A migration moves the existing text into templates, converting any
Mustache email mechanically: it reads the template with chevron (the library that rendered it),
resolves each name through the section scopes the way Mustache did, and maps it to the event's
variables, using the event's form schemas to tell lists from objects. Checked against the `data/`
emails as they were in Mustache, rendered both ways for the sample registrations, the output is
identical except that a camper's full lodging name no longer starts with the root lodging (the
camp itself) and the email loses a trailing newline. Anything it can't convert (a partial,
changed delimiters) keeps its text with a note, and the template checks report it.
**Context:** The two automatic emails were fields on the event and the registration type, with
their own engine each, while group emails were becoming templates — three places and two engines
for one kind of thing. One model gives one editor, one set of checks and one list of the event's
email, and removing Mustache removes a second variable model that had to be explained.
**Alternatives:** Keep the fields and only list them beside the templates — two storage models
remain, and Mustache with them. Convert by hand, as the `data/` emails were — live events hold
emails nobody here has seen, so a checked mechanical conversion is safer than asking every
organizer to rewrite theirs.

**Group email recipients and sends (addition):** A group email's default recipients are chosen with
conditions built field by field — a field from the event's catalog, an operator offered by the
field's type, and a typed value — stored as rules JSON the server evaluates against the same
variables a Jinja expression sees; a Jinja filter expression remains under Advanced, and both must
pass. The automatic emails are listed with the group emails but stay edited where they're set up
(the event, the registration type), which already offer previews for their own records. Each
send is a batch that records the recipients the admin reviewed (by key) and a snapshot of the
template; a task prepares it — at its time, for "send later" — rendering one copy per key through
the outbox (DR-44), so its progress is its copies' statuses. An ad-hoc filter while sending can
change who is chosen but not the source or the address and name expressions, which the batch
takes from the template.
**Context:** Most organizers don't write Jinja; the questions they ask ("who still owes money",
"vegetarians in the cabins") are one field compared with one value, which a builder covers
without code, while the expression keeps anything else possible. A catalog from the event's own
schemas names the event's real questions and choices, so a condition can't misspell a field.
Sending exactly the reviewed keys means what the admin confirmed is what goes out, even when data
changes before a later send; the snapshot lets the template be edited or deleted without changing
a send's record.
**Alternatives:** Expressions only (the task-based bulk email) — needs Jinja for every list. A
query language or nested groups — more than these lists need; any/all of flat rows plus an
expression covers them. Editing the automatic emails in the Email section too — a second editor
for the same text, without the confirmation's and invitations' own preview samples. Resolving the
recipients again when a send is prepared (the task-based bulk email) — the list could differ from
what was reviewed.

### DR-46 — SMTP passwords are encrypted; each account paces its own sending

**Decision:** An email account's password is stored encrypted (Fernet, under a `fernet:` prefix)
with a key from `CAMPHORIC_SECRET_KEY_EMAIL` (several comma-separated keys rotate: the first
encrypts, any decrypts; without one, a key is derived from Django's secret key). The API never
returns the password — only whether it's set, unset or unreadable (the key changed) — and a blank
password on an update keeps the stored one. Each account has a security mode (STARTTLS, SSL/TLS
or none), a timeout, and optional per-minute and per-day sending limits. Before sending, the
outbox worker counts the account's recent sends under a row lock on the account; over a limit,
the message waits — without counting as an attempt — until a slot opens, and the queue status
says why. An account an event or a sent email uses can't be deleted.
**Context:** Passwords were stored as plain text, in the database and every backup of it.
Gmail-style daily caps fail every message past the cap, so a large group email could use up a
shared account for the day; pacing per account turns that into a wait, and the lock keeps the
limits exact with more than one worker. Deleting an account used to delete the events using it.
**Alternatives:** Gmail OAuth — no stored password, but an OAuth app and token refresh per
organization. Encrypting with Django's secret key alone — rotating it would make every password
unreadable at once. Limits in the task queue — it has none, and limits kept per worker aren't
global.

### DR-47 — Replies go to the sender when no Reply-To is set

**Decision:** Every email has a Reply-To: the one its template (or the send) gives, else the sending
account's default Reply-To, else the email's own From address. The outbox fills it in when the
email is queued, so the history shows where replies go.
**Context:** Gmail's SMTP server rewrites an email's From to the account it signs in as unless the
From address is a verified "Send mail as" alias. A camp sending through a shared Gmail account
with From set to its registration address would otherwise get replies in the Gmail account's
inbox. A Reply-To equal to an unchanged From is harmless.
**Alternatives:** Require every account to set a default Reply-To — easy to miss, and one address
can't suit every event sharing the account. Fall back to the event's confirmation address — wrong
for a group email sent from a different address.

### DR-48 — Group email can be unsubscribed from, per event, with one click

**Decision:** Each copy of a group email carries a link, in a footer and as a `List-Unsubscribe`
header with `List-Unsubscribe-Post` (RFC 8058 one-click), to unsubscribe its address from that
event's group email. The link holds a token signed with Django's signing (the event and the
address), so it needs no login and can't be made for another address. A GET shows a page asking
to confirm and changes nothing; a POST — the page's button, or the provider's one-click request —
records the address. The page is rendered by the server, so it works from any mail client without
the app. Group email skips unsubscribed addresses when the recipients are worked out and again
when a send is prepared; confirmations, invitations and tests aren't affected. Organizers see
the list and can add or remove addresses. Links point at `CAMPHORIC_PUBLIC_URL`, else the host the
send was made from, recorded on the send because copies are prepared by the worker, outside any
request.
**Context:** Gmail and Yahoo expect bulk mail to offer one-click unsubscribe and treat mail
without it as more likely spam; an event's announcements reach hundreds of people, and without a
way out, people mark them as spam instead, hurting delivery of every email the account sends,
confirmations included. Scoping it to the event keeps a camper who opts out of one event's
reminders reachable for next year's event, and keeps registration-related notices — which are
the event's business — out of the question.
**Alternatives:** A `mailto:` unsubscribe header only — nothing is recorded, and someone has to act
on each request by hand. Organization-wide unsubscribes — one opt-out would silence every
future event. An "essential" flag letting some group emails reach unsubscribed addresses —
more to explain, and easy to overuse; an organizer can still email someone directly. A link that
unsubscribes on GET — link scanners and previews would unsubscribe people who never clicked.

### DR-49 — Lists read as sections, one box per item

**Decision:** The form engine replaces the `@rjsf/mantine` array templates. An array field shows
its title as a section heading, like an object's, then its description and items. Each item is a
bordered box with its remove button in the top-right corner, and the add button is labelled from
`ui:options.addButtonText` (or "Add <item title>"). Reordering is off unless a field opts in with
`orderable: true`. The registration page also hides fields classed
`camphoric-hide-during-registration`, as the v1 client did.
**Context:** The theme draws an array as a filled, bordered `fieldset` with its heading on the
border, so a list such as Lark's parking passes looked unlike every other section, its heading
straddling two backgrounds. Its add button is an unlabelled "+" titled "Add Item", ignoring the
`addButtonText` the events' uiSchemas set, and it offered move buttons for lists whose order means
nothing. The v1 client had its own array template with a labelled add button and only a remove
button per item. Its registration-page CSS hid `camphoric-hide-during-registration`; without it,
registrants were shown the parking type organizers assign. DR-29 assumed the theme covered array
labels; it doesn't.
**Alternatives:** Restyle the theme's fieldset with CSS — its legend and fill are the problem, and
the add button would still be unlabelled. Change each event's uiSchema to turn ordering off —
every event's data would need editing and reimporting, when no registration list is ordered.

### DR-50 — Site-wide Camphoric permission groups, enforced by the server

**Decision:** Every admin user has one site-wide role — Admin, Registrar or Reporter — kept as
membership in a Django group of that name and called their **Camphoric permission group**. A
superuser always counts as Admin. Django access (`is_staff`: may use Django's admin site;
`is_superuser`: has every Django permission) is a separate setting that only superusers change,
and the API never looks at `is_staff`. Every admin endpoint is closed by default (DRF's default
permission is Camphoric's role check); public endpoints opt out explicitly, and a test walks the
URL configuration to keep it that way. Any role may read, including POSTs that only read (a
preview, a render); Registrars and Admins may write; organizations and users are Admin-only, and
user management answers 404 to everyone else so it isn't even confirmed to exist. When roles
arrived, superusers became Admins and other staff Registrars, so nobody lost access.
**Context:** Every admin endpoint checked only `is_staff`, so every staff user could do
everything — including editing any user and making them a superuser. Camps want some helpers to
see registrations and run reports without being able to change them, and user management kept
to a few. Each camp runs its own server, so one site-wide role per user is enough; groups need
no new tables and show in Django's admin. Keeping Django access separate means most users never
see Django's admin, and only superusers can grant it (otherwise an Admin could make themselves a
superuser through a second account).
**Alternatives:** Roles per organization — needed only if one server hosts several camps, and
every query would have to filter by organization. A role field on a profile model — a second
table for what a group already expresses. Tying Admin to `is_superuser` — would hand every Admin
raw database access through Django's admin. Keeping `IsAdminUser` on each view and adding checks
case by case — easy to miss one, where closed-by-default fails safe.

### DR-51 — A read-only admin for Reporters, from one permissions context

**Decision:** The admin shell provides the signed-in user's permissions (`canEdit`,
`canManageUsers`, `canManageOrganizations`) through a context. Controls that change data are
wrapped so they render only when the user can edit; form bodies are wrapped in a disabled
fieldset; schema forms and the code editors turn read-only on their own when the user can't
edit; the lodging timeline drops its drag sensors. The context's default is unrestricted, so the
public registration pages, Storybook stories and tests that render components on their own are
unaffected. A 403 that still happens gets a plain "You don't have permission to do that."
**Context:** A Reporter's view should show everything they may read without offering buttons
that would only fail. The server remains the authority (DR-50); the UI's job is not to invite a
refusal. Defaulting the shared form and editor components from the context covers most screens
without threading a prop through each.
**Alternatives:** Disable the whole admin with one fieldset — would also disable navigation,
tabs, filters and previews. Pass a `readOnly` prop down every screen — more churn, and easy to
forget on a new one. Show everything and rely on 403s — every attempted change would fail after
the fact.

### DR-52 — Passwords by emailed one-time link; superusers can set one to be changed

**Decision:** New users choose their own password through an emailed **set-password link**, and
anyone can ask for one from the sign-in form. The link is Django's password-reset token (single
use: it stops working once the password changes or the user signs in; it expires after
`PASSWORD_RESET_TIMEOUT`, 3 days by default) and opens a public page in the client
(`/account/set-password/:uid/:token`). Asking for a link answers the same whatever the address,
and is throttled. Account email goes through the outbox (DR-44) from `DEFAULT_FROM_EMAIL` and
the default mailer, and is hidden from the email history for anyone who isn't an Admin (it holds
live links). When email doesn't work, an Admin can copy a link to hand over, and
`manage.py camphoric_password_link` prints one (or sets a password). A superuser can set a
password directly, by default requiring a change at the next sign-in; until then the server
refuses everything but changing it, and the client shows only that form.
**Context:** No endpoint set passwords, so new users needed someone with shell access. An
emailed link means the admin never knows the password and "forgot password" comes for free.
Test servers often send email only to a log, so the copy-link and command fallbacks keep them
usable. Setting a password is sometimes simply faster (a new helper at the registration desk),
and requiring a change keeps it from becoming their permanent password; enforcing that on the
server means a stale browser tab can't skip it.
**Alternatives:** Admins set every password — they'd know them, and resets would all go through
them. A server-rendered set-password page (like the unsubscribe page, DR-48) — that page must
work in any mail client with one click; this one belongs to the admin app, with its forms and
validation. Enforcing the forced change only in the client — the API would still accept the old
password's session for everything.

### DR-53 — An audit log of changes, with old and new values

**Decision:** The server keeps an **audit log** with django-auditlog: every change to the event
data, organizations, email settings and users records who made it, when, and each changed
field's old and new values; deletes record the last values. Only changes are logged, not reads,
and entries are kept indefinitely. Timestamps, PayPal's replies (they carry payer details and are
written once by the payment flow) and passwords are left out; pricing results are kept, so a
balance's history shows. The email outbox isn't tracked — its history already records each
message. Registrars and Admins can read a registration's or camper's history (Reporters can't);
superusers see the whole log in Django admin.
**Context:** The admin now has several users with different roles, and nothing recorded who
changed a registration, payment or lodging assignment, or what it said before — a mistaken edit
couldn't be traced or undone by hand.
**Alternatives:** django-simple-history (a full copy of each row per change, in a table per
model — more storage and migrations, for a whole-row view this admin doesn't need).
django-pghistory (Postgres triggers — also catches bulk updates, but ties the log to Postgres and
makes crediting the signed-in user harder). Logging reads too — far more data, for a privacy
audit nobody has asked for. Leaving pricing out — fewer entries, but no record of how a balance
changed.

### DR-54 — What a delete takes with it, shown before it happens

**Decision:** Deleting through the admin API never takes registrations, campers or payments with
it by accident:
- A lodging's campers are unassigned, their stay cleared.
- A registration type's registrations are kept with no type. Its invitations are still deleted,
  and so is its invitation email, rather than left orphaned.
- A deposit's payments are kept.
- A custom charge type campers still have can't be deleted.
- An organization with events can't be deleted, in the API or in Django admin.
- Only Admins delete events, and only before anyone has registered.
- An invitation outlives its registration.

Each rule is a foreign key's `on_delete` (`SET_NULL` or `PROTECT`), so Django admin follows it
too. Every delete is worked out first as a plan — what blocks it, what goes with it, what's left
changed — from Django's own delete collector plus a view's own rules (unassigning campers one by
one, so pricing is recalculated and each change is in the audit log, DR-53). The admin shows the
plan in the delete confirmation (`delete-preview`), and the delete carries out the same plan.
**Context:** An audit of every cascade found deletes that silently removed people's data:
deleting a lodging deleted every camper assigned to it or who had asked for it; deleting a
registration type deleted its registrations with their campers and payments; deleting a deposit
deleted its payments; deleting a charge type removed that charge from every camper's balance.
The confirmation dialogs couldn't say what would happen, because the client didn't know.
**Alternatives:** Refusing to delete a lodging while campers are assigned — safer, but moving
dozens of campers by hand first is the common case when reorganizing. Working out the preview in
the client — it would drift from the server's rules. A dry run that deletes inside a rolled-back
transaction — exact, but it would run the delete's side effects (signals, pricing, the audit log)
just to preview it.

### DR-55 — Soft delete for registrations, campers and payments

*Promo codes were later made soft-deleted too (DR-67).*

**Decision:** Deleting a registration, camper or payment through the admin marks it deleted
instead of removing it; Registrars and Admins can list what's deleted, with who deleted it, and
restore it. Only these three are soft-deleted — everything else is deleted for real (DR-54),
with the audit log (DR-53) keeping its last values. "Not deleted" is built into these models'
default managers: a deleted registration hides its campers, payments and charges without marking
them, so restoring it brings back exactly what went with it, while a camper or payment deleted
on its own earlier stays deleted. A deleted registration's price is left as it was, and
recalculated when it's restored.
**Context:** A mistaken delete of a registration or payment couldn't be undone; the models
already had an unused `deleted_at`. These are the records people type in and money depends on;
the rest (lodging, reports, templates, …) is set up by organizers and easy to recreate.
**Alternatives:** Soft delete for every model — many more places that would have to hide
deleted rows, and unique names blocked by deleted ones, for data that's cheap to recreate.
Marking the children too, with a shared timestamp to restore them together — more writes and
bookkeeping for the same result. Filtering deleted rows by hand in each query (the old
convention) — easy to miss in pricing, lodging counts, reports and the public flow; only joins
from another model (the lodging counts) still need it.

### DR-56 — Per-line pricing overrides, on top of JsonLogic

**Decision:** Pricing rules stay JsonLogic, written by developers. Registrars and Admins can set
the amount of any single price line of a registration or camper — tuition, meals, a donation, the
electronic-payment handling fee — with a reason, in place of what the rules compute; the total
can't be set, only its lines. An override is stored data applied right after its line on every
recalculation, so it survives later edits and everything after it follows. The admin shows the
computed amount it replaced; registrants only ever see the result. Overrides are in the audit log
and the change history (DR-53).
**Context:** #667 set out to "recreate pricing". Working through it: developers write the rules
and will keep doing so; every rule in the four events (lookup tables, age groups, per-day rates,
early-bird dates, registration-type exceptions, percentage discounts, caps) is expressible in
JsonLogic — the 40%-off-tuition discount of #568 already is. The need was one-off adjustments: a
registrar could only add a custom charge, a separate line, not correct the line that was wrong.
Replacing the engine is researched separately (#674); overrides sit on top of any engine.
**Alternatives:** Percentage overrides ("40% off this line") — more to explain, and a fixed amount
covers the one-off cases; percentages that apply to many registrations belong in the rules.
Overriding the total — the breakdown would no longer add up. Custom charges only — they add a
line rather than correcting one, and can't touch registration lines or the handling fee.
Replacing JsonLogic now (structured rules, Python pricing, an expression language) — a large
migration that doesn't address adjustments (#674).
**Amended by DR-88:** the electronic-payment handling fee is no longer a price line, so it can't
be overridden here; it's edited on its invoice.

### DR-57 — Organizers can mark lodging full or open

**Decision:** Each lodging node has an availability: **by capacity** (the default), **always
full**, or **always open**. It decides only whether the registration form offers the node as full;
the capacity and remaining-capacity counts are left as they are, for reports and the admin. A node
left by capacity is full when its remaining capacity is used up — unless something under it is
marked open — or when every visible choice under it is full. So marking every cabin full fills
the cabin area, and marking one tent spot open keeps its camp choosable. The server works this
out and sends `full` on each lodging node; the form follows it.
**Context:** The automatic cut-off doesn't always match what organizers want (#602): they need to
close a lodging type that still has room (it's being held, or they're reorganizing), or keep one
open past its count (they know the real space better than the numbers).
**Alternatives:** Setting capacity to the current count to close it, or raising it to open it —
the workaround organizers used, but it corrupts the counts reports rely on and has to be undone.
Hiding the lodging (`visible`) — it disappears instead of showing as full, which confuses people
who expected it. Working out "full" in the client — it would drift from the server's counts
and rules.

---

### DR-58 — Bundle Monaco; keep the React wrapper

**Decision:** Monaco is a dependency of the app (`monaco-editor`) and is bundled by Vite, lazily,
with its editor and JSON web workers; `@monaco-editor/react` stays as the React wrapper, with its
loader handed the bundled instance (`loader.config({ monaco })`). Only what the admin uses is
imported — the editor's features, JSON, and highlighting for Handlebars, Markdown and HTML — not
the whole package, whose TypeScript and CSS services add 8 MB of workers. Workers are emitted
into `static/` with the rest of the build, since that's all the server serves.
**Context:** The wrapper's loader fetched its own pinned Monaco (0.55.1) from jsdelivr, whatever
the lockfile said. So Dependabot's alerts on the installed copy (DOMPurify, inside Monaco) could
be silenced by an upgrade while browsers kept running the old one, and every admin session,
Ladle and the e2e suite depended on a third-party CDN being reachable.
**Alternatives:** Pinning the loader's CDN path to the installed version — keeps the CDN
dependency, and the two can drift again. Replacing the wrapper with our own component — about 150
lines to own and test (models per path, outside value changes without losing the cursor or undo
history, StrictMode, cleanup), for no fix beyond what bundling gives; revisit if the wrapper ever
blocks a React or Monaco upgrade. Importing all of `monaco-editor` — simplest, but ships the
unused language workers.

### DR-59 — Storybook replaces Ladle as the component workbench

**Decision:** The component stories run in **Storybook** (`storybook` + `@storybook/react-vite`),
built with the app's own `vite.config.ts` (its type/lint checker left out) and wrapped in the
app's Mantine provider and dark theme. Stories are CSF function stories (`StoryFn`). Each stories
file's meta title is its component's name in words (`'Confirm Delete'`), which gives the same
story ids Ladle derived from the file name (`confirm-delete--blocked`), so the e2e suite (DR-31)
opens the same stories at Storybook's `iframe.html?id=…`. Telemetry is off.
**Context:** Ladle ships its own Vite, and its last release (5.1.1, November 2025) is on Vite 6,
which by late 2026 gets security fixes only and loses support when Vite 9 ships. Ladle's move to
Vite 8 was merged in June 2026 but not released, and its pull requests have gone unreviewed since.
Because Ladle loads the app's Vite config, the app's own Vite and `@vitejs/plugin-react` upgrades
were held to what Ladle's Vite could run. Storybook supports Vite 5–8 and React 16–19 and is
actively released, so the workbench no longer gates the app's build tooling.
**Alternatives:** Staying on Ladle and letting the app move to Vite 8 alone — works, but keeps a
second, soon-unsupported Vite and caps `@vitejs/plugin-react` at a line that still supports Vite 6;
every future Vite major waits on a Ladle release. React Cosmos (maintained, any Vite) — its
fixture format means renaming and restructuring every stories file and changing every e2e story
URL. Storybook's costs: a larger install and slower build than Ladle, and its own major-version
upgrades (largely automated by `storybook upgrade`).

### DR-60 — A registration's notes are its free-text fields

**Decision:** Where the lodging screen shows "the registration's notes" (§8.6), it shows the
registration's top-level fields that its form renders as a textarea (`ui:widget: textarea`),
each under its own title — Lark's "Comments", for instance. Nothing is shown when none are filled.
**Context:** The old client read `registration.attributes.notes`, a key Lark's registrations
don't have (theirs is `comments`). The client is data-driven (§1), so it can't assume a field
name; a textarea is how an event asks for free-form text.
**Alternatives:** Every registration field in readable form — complete, but buries the notes
among addresses and phone numbers. Hard-coding `comments` and `notes` — works for today's events
only.

### DR-61 — Selecting a camper on the lodging screen shows their details in place

**Decision:** Clicking (or pressing Enter/Space on) a camper anywhere on the lodging screen
selects them — `?camperId` — and their lodging details show beside the open view (§8.6). Opening
the camper's record is an explicit action from those details.
**Context:** Clicking a timeline card opened the camper's record, leaving the lodging screen. The
card is also the drag handle: a drag starts only after the pointer moves 5px, so a slightly
shaky click navigated away, and the click the browser fires after a drag or resize did too.
Admins also needed a camper's lodging needs while placing them, and the old popover showing them
opened on hover — which fights with dragging and doesn't exist on touch screens.
**Alternatives:** A separate "open" control on each card — keeps navigation a click away but
leaves the details problem unsolved. Suppressing the click after a drag or resize — fragile
bookkeeping, and a short click would still navigate. A hover popover, as before.

### DR-62 — Timeline drop targets are rows, not day cells

**Decision:** Each unit's row is a single dnd-kit drop target; the day a camper lands on is read
from the pointer's position along the row (tracked during the drag). The day grid is drawn as a
background rather than an element per cell. Rows are memoized with stable callbacks, so starting
or ending a drag doesn't re-render the unchanged ones. The day columns share the available width
evenly, down to a minimum below which the timeline scrolls sideways; departure day (DR-65) is
drawn as a half column — its morning — since no stay reaches past its midday.
**Context:** With a drop target per unit per day, Lark (about 300 units over 10 days) had about
3,000 targets. dnd-kit re-renders every droppable and draggable whenever the target under the
pointer changes, and measures every droppable as a drag starts, so dragging stuttered: in a dev
build a pointer move took 78 ms on average (325 ms at the 95th percentile). With row targets it
takes about 14 ms (44 ms), and the page has half as many elements.
**Alternatives:** Memoizing the cells — doesn't help, since they re-render through dnd-kit's
context, not their props. Virtualizing the rows — more machinery than the problem needs now; worth
revisiting for much larger events. Pragmatic drag and drop (see DR-6).

### DR-63 — Narrowing the timeline to any set of lodging nodes; units grouped by where they are

**Decision:** The timeline can be narrowed to any number of lodging nodes, leaves included, chosen
from a searchable list of full paths, and kept in the URL (`?lodgingFilter`). Units are grouped
under their parent's path, the groups sorted by that path and the units by name in natural order.
**Context:** The filter offered only nodes with children, one at a time, so a top-level unit
with no sub-units (Lark's "Off Site") couldn't be picked, two areas couldn't be compared side by
side, and the choice was lost on leaving the page. The rows showed only a unit's own name
("Cabin 05"), which doesn't say which camp it's in, and came in id order, so a unit added later
sorted last.
**Alternatives:** Only the top-level areas — short, but can't narrow to one tent area. A
level-by-level picker walking the tree — one branch at a time, and slower to use than typing part
of a name.

### DR-64 — Dates display in local time

**Decision:** Dates are shown in the viewer's local time (§10). Date-only values are read as local
midnight of their own day, so a label always names the calendar day the value holds.
**Context:** DR-5 carried over the old client's practice of rendering day labels at a fixed UTC
offset. Organizers expect the dates they see to be in their own time, and reading a `YYYY-MM-DD`
value in local time gives the same calendar day as reading it in UTC, so the fixed zone bought
nothing for display.
**Alternatives:** Keep rendering in UTC — right for date-only values, but it shows timestamps
at the wrong hour and date for anyone outside UTC.

### DR-65 — No one stays over on the last day, enforced in the client

**Decision:** A camper's `stay` never includes the event's last day (§8.6). The lodging screen
doesn't offer it, and a drop or resize that reaches it stops on the day before. Only the client
enforces this; the server stores whatever days it's sent.
**Context:** A stay lists the days a camper is present, arriving midday on the first and leaving
midday the day after the last. At every camp the organizers have run, campers leave on the last
day, so a stay that includes it means a night that doesn't exist; the timeline allowed it, and
bars dragged to the end of the grid created one.
**Alternatives:** Validating on the server as well — would guard every writer (imports, the API),
but no other writer sets stays today. A per-event setting for camps where people do stay over —
no such camp yet; the rule lives in one helper (`stayableDays`), so it's easy to make
configurable later.

### DR-66 — Checkbox choices are saved in option order

**Decision:** A checkboxes field saves its chosen values in the order the schema lists the
options (§9.1). The client wraps the `@rjsf/mantine` base widget to reorder what it reports; the
server stores the list as sent.
**Context:** The base widget reports values in the order they were ticked (Mantine's checkbox
group appends each new one), so a camper who ticked Fri, Sun, Sat was saved that way, and the
confirmation email listed the days out of order. rjsf's own core widget keeps option order; the
Mantine theme doesn't. Fixing the stored order fixes every email, report and view at once, where
sorting at display time would need each template to know the option order.
**Alternatives:** Sort in each email and report template — every template would repeat it, and
Jinja templates don't have the schema's option order to sort by. Sort on the server — the server
doesn't otherwise interpret form fields. Neither reorders registrations already saved; those keep
their stored order.

### DR-67 — Promo codes carry their own discount logic

**Decision:** An event's promo codes are records of their own (§5, §8.8): a label, the code
registrants type (matched without regard to case), whether it's enabled, an optional expiry, and
a JsonLogic expression for the discount with a scope — once for the registration, or for each
camper. A registration has at most one code. The discount is worked out after every other price
line and before the e-payment handling fee, as a positive amount, never more than the total (or
the camper's total) it comes off, so a code can't add a charge (§9.2). The event's own pricing
logic doesn't see the code. Registrants enter a code in the form just above advancing to
payment; the server checks it (`checkpromo`) as it's applied, and a code that's been typed but
not applied, or that the server refuses at submit, stops the registration from going through
(§7.1). Whether a code is usable is decided when it's applied: afterwards the registration keeps
it — through expiry, being turned off, or being deleted — and its discount is recomputed with
the code's current logic whenever the registration is repriced. Codes are soft-deleted (DR-55)
so deleting one never reprices a registration. Registrars can set or clear any registration's
code.
**Context:** Camps wanted discounts registrants unlock by typing a code (#651). An early server
attempt exposed the code's name to the event's pricing logic, which would have spread each
code's rules through the event-wide logic; keeping the logic on the code puts everything about a
code in one place that organizers manage in Settings. A per-camper scope is needed for discounts
like "half off each child's tuition".
**Alternatives:** Expose `promo.name` to the event's pricing logic — every code's rule would live
in the event logic, far from the code. A list of `{ var, label, exp }` components per code —
more to write for the common single-discount case. A signed amount added like any line — lets a
code add a charge and needs care to cap. Ignoring an invalid code at submit — registrants would
pay full price without noticing. Several codes per registration, or usage limits — not needed
yet. Hard delete that clears the code from registrations (SET_NULL) — would silently reprice
them; blocking the delete instead would leave unwanted codes in the list.

### DR-68 — No total is negative

**Decision:** The pricing engines (client and server) floor every camper's `total`, and the
registration's total once all campers are summed, at 0 (§9.2). Only the totals are floored: the
lines that make them up are shown as worked out, so a credit larger than what it comes off
still shows its full amount. The floor is applied before the promo code and the handling fee,
and holds whatever produced the negative amount — the event's logic, a negative custom charge,
or a registrar's override.
**Context:** Camp Harmony's campership was a credit taken off each camper's lodging; a
registrant gave a campership to an infant, whose lodging is free, and the infant's negative total
was taken off the adult's, doubling the adult's campership (#714). The form can't stop every
such combination, and the event's logic would need a floor on every credit, so the engine
guarantees it instead. A registration never has a negative amount owing; money owed back to a
registrant is a refund, not a price.
**Alternatives:** Hide the campership request for campers who pay nothing — Harmony-specific,
and the question shows before the price is known. Floor each credit at what it comes off in the
event's logic — every event's logic must remember to, and a forgotten one is the same bug.
Floor only the registration's total — one camper's credit would still come off another's
charges, which was the bug.

### DR-69 — Pricing logic must have a total

**Decision:** The server refuses an event's `camper_pricing_logic` or
`registration_pricing_logic` (400, on create or update) unless it's a list of components, each
an object with a string `var` and an `exp`, one of them with `var: "total"` (§5, §8.8). It
checks the shape only, not the expressions.
**Context:** The `total` lines are what everything downstream reads: the registration's amount
owed, the promo-code discount and its cap (DR-67), the floor at 0 (DR-68), the handling fee,
payments, and reports. Logic without one prices every registration at $0 with no error, and is
easy to do by hand-editing the JSON in Settings. Logic that isn't a list of `var`/`exp`
components makes pricing fail outright.
**Alternatives:** Check it in the client's Settings editor — the data loader and other API
callers would still get through. Treat a missing `total` as the sum of the other lines — not
every line is money (some are counts or rates), so the sum would be wrong.

### DR-70 — Lodging notes: an icon on the hierarchy, a details panel on the timeline

*Edit, offered here only in the hierarchy's details, is offered on both views since DR-75.*

**Decision:** On the hierarchy, a node with notes has an icon beside it that opens them on
click. On the timeline, units and groups whose node has notes are marked with an icon, and a
unit's or group's name selects that node (`?timelineLodgingId`), showing its details, notes
included, beside the timeline (§8.6). A node's name in the hierarchy selects it the same way
(`?lodgingId`), and its details there offer Edit. A unit's row label on the timeline is just its
name: its occupancy is in those details, and in the hierarchy. Notes are still edited in the
node's form.
**Context:** Organizers' notes on lodging (e.g. "1 bunk, 1 single - ADA") could be edited but
were shown only as the selected camper's unit notes, so they weren't in view while placing
campers (#520). The hierarchy has room beside each node for an icon; the timeline's unit labels
are narrow and its rows are packed with bars, so a side panel suits it, matching how a selected
camper's details show there (DR-61). Four ways were built and tried on real data before
choosing.
**Alternatives:** Each note's text under its node in the hierarchy, with an icon on the timeline
— long notes push the tree apart. Icons with popovers everywhere — a popover over the timeline
covers the bars being placed. A "Show notes" switch putting the text everywhere — timeline rows
grow to fit and the grid gets hard to scan. Hover popovers — no equivalent on touch screens, and
they fought with dragging (DR-61).

### DR-71 — Each lodging view keeps its own selection

**Decision:** The hierarchy and the timeline each have their own selected camper and lodging
node — `?camperId` and `?lodgingId` on the hierarchy, `?timelineCamperId` and
`?timelineLodgingId` on the timeline (§4, §8.6). Details opened in one view don't show in the
other, and each view's selections are still there on switching back.
**Context:** One `?camperId` served both views (DR-61), so a camper's details opened while
placing campers on the timeline followed the admin to the hierarchy, where they were working on
something else. The hierarchy keeps the original name, so a link to the lodging screen with a
camper selected opens on its default view as before.
**Alternatives:** Clear the selection whenever the view changes — one parameter, but switching
back and forth loses the camper being placed. Keep one shared selection, as before.

### DR-72 — The camper record shows its lodging and who's in the unit with it

*The stay became editable in this section: see DR-103.*

**Decision:** The camper's record has a read-only lodging section (§8.5): the unit and the
camper's stay, the unit's notes, and the other campers placed in the same unit with their stays,
each opening that camper's record, plus a way to the lodging screen with the camper selected.
Placing the camper stays on the lodging screen (§8.6).
**Context:** The old client's camper editor had a lodging tab, and organizers asked for the
unit's notes there (#520). Working from a camper's record, they also need to see who they're
sharing with, which otherwise means finding the unit on the lodging screen.
**Alternatives:** Only the unit's path and notes — leaves "who's in there with them" to the
lodging screen. Editing the stay here as well — the lodging screen already does it, with the
unit's occupancy in view; it remains the planned "Set the lodging stay" capability.

### DR-73 — The template editor can hide its preview and expand to fill the screen

**Decision:** The template editor (§9.6) has two ways to make room: hide the preview so the text
takes the full width (the problem count stays visible), and expand the whole editor — text,
preview and help — to fill the screen. Both apply everywhere the editor is used (reports, emails,
the confirmation page).
**Context:** Report templates are edited in a card on the reports screen and email bodies sit
beside their preview inside a dialog; organizers found both too cramped to write long templates
in.
**Alternatives:** Moving the preview into its own dialog — the preview is most useful while
typing, so it should stay beside the text. A draggable split between text and preview — more
machinery, and still bounded by the surrounding card or dialog. Expanding only the text without
the preview and help — loses the feedback that makes the editor worth using.

### DR-74 — The lodging views are labelled Layout and Assignments

**Decision:** On the lodging screen (§8.6) the hierarchy is labelled **Layout** and the timeline
**Assignments**. The URL values (`?lodgingView=hierarchy|timeline`, §4) and the selection
parameters keep their names, so existing links still open the same view.
**Context:** "Hierarchy" and "Timeline" describe how each view is drawn, not what it's for:
organizers set up and review the camp's lodging on one and place campers on the other.
**Alternatives:** "Full Tree" — still names the drawing. "Buildings & Units" — not all lodging is
a building (tents, RV spaces). "By Place" / "By Day" — accurate, but says less about what each
view is for. Renaming the URL values too — breaks saved links for no gain.

### DR-75 — Lodging details offer Edit on both views

**Decision:** A selected lodging node's details offer Edit on the timeline as well as the
hierarchy (§8.6), opening the same node form.
**Context:** DR-70 offered Edit only beside the hierarchy, where nodes are managed. While placing
campers on the timeline, organizers spot a unit whose capacity or notes need fixing and had to
switch views, find the node, and select it again to change it.
**Alternatives:** Keep Edit on the hierarchy only — the detour above. Edit the notes in place in
the details — a second way to edit one field, beside the form that edits them all.


### DR-76 — Incomplete registrations are deleted after a month untouched

**Decision:** Each night the task worker (DR-44) deletes the registrations that were started but
never finished and that nobody has changed in 30 days, counted from their last change, with
their campers, charges and pricing overrides. They're deleted for real, not soft-deleted
(DR-55); the audit log (DR-53) keeps their last values. One with a payment, even a deleted one,
is left alone. Invitations and sent email that point at one keep their rows, unlinked from it,
so an invitee can register again. The run is at 3 a.m. California time; a command runs it on
demand and previews what it would delete.
**Context:** Every registrant who stops partway leaves a registration behind, which piles up in
`incomplete_registrations` and the database (GitHub #339). A month leaves time to follow up
with someone who stopped, using the incomplete registrations a report or group email can reach.
**Alternatives:** Soft delete — restorable, but the Deleted list would fill with abandoned forms
nobody wants back. Counting from when the registration was started — would sweep one a
registrant came back to recently. A few days — too short to follow up. Deleting ones with a
payment too — money is never deleted by a background job.
**Note (DR-91):** a registrant who presses PayPal and doesn't finish is completed now, so they're
in the admin lists rather than left as an incomplete registration.

### DR-77 — Keep PayPal's card button; block the page only after approval

**Decision:** Card payment uses PayPal's own Debit or Credit Card button, left enabled. The
payment page blocks interaction only once the payer approves (while the order is captured and
the payment posted), never while PayPal's popup or inline card form is open. Cancelling, an SDK
error, or a failed capture lifts the block. The button the payer clicked decides whether the
payment is recorded as `Card` or `PayPal`.
**Context:** Camp Harmony registrants (GitHub #646) were told to pay by card through the PayPal
button, though PayPal also showed a card button. Clicking that card button opens its form inline,
under the page, and the in-flight overlay, shown as soon as the order was created, covered the
form so it couldn't be filled in. Nothing lifted it short of leaving the page.
**Alternatives:** Hiding the card button (`disable-funding=card`) — PayPal advises against it,
since it's the way to pay without a PayPal account, and card payers would be pushed through the
PayPal popup. A separately hosted card-fields integration — more work, and more PCI scope to
consider.

### DR-78 — The handling fee paid online is kept; registrars can recalculate it

**Superseded by DR-88.** (Original decision: keep the handling fee charged online as a pricing
override of the registration's `handling` line, which a registrar could recalculate.)
**Decision:** When a registrant pays by PayPal or card, the server records the handling fee as a
pricing override (DR-56) at the amount charged. Later changes to the registration — a discount,
an adjustment, a camper added — leave the fee as it was. A registrar can recalculate it, which
sets the override to the fee the total works out now and keeps that; or change or remove it like
any override. Both engines round the fee in cents, a half cent up.
**Context:** The fee is a percentage of the total, so every adjustment after payment changed it,
which Lark found confusing (GitHub #622). Separately, the client and server rounded a half-cent
fee in opposite directions (the server's float `round`, the browser's `toFixed`), so a PayPal
payment of the client's amount often left a balance of ±$0.01.
**Alternatives:** Leaving the fee to recompute, with registrars overriding it by hand — what was
already possible, and what Lark found confusing. Charging the fee on each electronic payment
rather than on the total — closer to what PayPal charges, and it would cover a second payment
or switching from check (#623), but it reworks payments, balances and reports. Pricing only on
the server (#675) would remove the second rounding, but is a larger change.

### DR-79 — Ask before leaving unsaved template changes, through the router's history

**Decision:** A page editing a template registers a blocker with the router's history while its
edits are unsaved, so every navigation — links, back/forward, search-param changes, and
`beforeunload` — waits on a confirm dialog; the same dialog guards the page's own Cancel and
close actions. A blocker is released once its edits are saved, so the navigation that follows
a save isn't questioned. Where the editor unmounts on a page's own selection (Reports), the
page owns the guard and the form reports whether it has changed.
**Context:** Template text is long and was lost silently by clicking another report, closing a
dialog, or following the sidebar. The router's `useBlocker` needs a router in context, which
the components' unit tests and stories don't have; registering with `history.block` directly
does the same, and is skipped outside a router.
**Alternatives:** TanStack's `useBlocker` (needs a router in every test and story). A
`beforeunload` handler alone (misses in-app navigation, which is most of it). Autosaving drafts
(a larger change, and a saved template takes effect at once). Guarding every admin form, not
just templates — left for when it's asked for.

### DR-80 — A user's change history is what they changed, paged, for Admins

**Decision:** Users (§8.10) shows, for a chosen user, the audit entries crediting them as the
actor — every change they made, in every event — newest first, served 50 a page from
`/api/users/{id}/history/` with the user API's Admin-only permission. Entries keep the §5 shape
and its rendering, naming every object in full since the list spans registrations and events.
**Context:** Admins asked to see what a given person has been changing. The registration and
camper histories (DR-53) find entries by their registration/camper tags, which events, reports,
lodging and users don't carry, so a user's history is found by actor instead. One person's
changes over seasons run to thousands of entries (the dev admin had 858), so they're paged.
**Alternatives:** Changes made *to* the user's account (role, active, email) — a short list,
but not what was asked; it can be added as its own section. Showing every entry at once (the
registration histories do) — too many for one response. Tagging every entry with its event,
to show which event a change was in — needs a new tag on every audited model and old entries
wouldn't have it.

### DR-81 — Long changes are diffed line by line, with a small built-in diff

**Decision:** In change histories, a long structured or multi-line value is pretty-printed and
compared line by line — the changed lines with a little context, unchanged runs counted — rather
than shown whole; other long values are cut short with a way to see the rest; old values are
reddish and new ones greenish. The line diff is the client's own (a longest-common-subsequence
diff after matching the common start and end, which keeps typical edits cheap; past four
million line pairs the changed middle is shown as removed then added).
**Context:** A user's history (DR-80) and an event's own changes include whole pricing logic and
schemas — thousands of lines of JSON for a one-number edit — which made the lists too long to
skim and hid what had changed.
**Alternatives:** The `diff` (jsdiff) package — robust and fast, but a dependency for one view.
A structural JSON diff by key path — exact for objects, but JsonLogic is mostly arrays, where an
insertion shifts every later index. Always cutting values short — shorter, but doesn't show
what changed.

### DR-82 — A way back sits at the far left of the header, before the title

**Decision:** A screen's way back up to where it was reached from is a back-arrow icon button in
the app header, at the far left, immediately before the "Camphoric Admin" title, named for where
it goes, and not repeated in the page body. New ways back follow the same placement. This is one
of the few placements the spec fixes rather than leaving to the implementer.
**Context:** The Event Admin had its arrow in the header, left of the title, while the event
chooser had one in the page body next to its heading — two places for the same thing. Putting
every way back in one spot means it's always where the user looks for it.
**Alternatives:** Leaving placement to each screen, as the spec does for layout generally — what
let the two drift apart. Breadcrumbs — more than two levels of choosers don't exist to justify
them. A back link in the page body — scrolls away, and sits in a different place on each screen.

### DR-83 — Search params are written and read as plain strings

**Decision:** The router is given its own search parser and serializer: every value is written
as-is (URL-encoded) and read back as a string, with empty values left out; a value written
JSON-quoted (`"71"`) is unquoted on reading, so earlier links still work.
**Context:** TanStack Router's default serializer JSON-quotes any string that looks like a
number or boolean, so selecting report 71 wrote `?reportId=%2271%22`; its parser reads an
unquoted `71` as a number, which the admin routes' string-only search (`AdminSearch`) dropped —
so a typed or pasted `?reportId=71` selected nothing. The registration flow also sends the
address bar's query string to the server as is, where a quoted invitation code wouldn't match.
**Alternatives:** Keeping the default and accepting numbers in each route's `validateSearch` —
fixes reading, but URLs stay quoted. Storing ids as numbers in search — typed better, but every
selection, tab and table param is a string by contract (DR-2), and the quoting would remain for
string values like `new`.

### DR-84 — Users opens over the current page, kept in that page's URL

**Decision:** Users is an overlay over whichever admin page is showing — drawn full-screen with
a close button in the upper right, like the template editor's expanded view — rather than a
page of its own. Its state rides on the underlying page's URL (`?overlay=users`, `?userId`,
`?historyUserId`), so it's linkable, back/forward open and close it, and closing it only drops
those params: the page underneath was never left, so nothing reloads and unsaved work survives.
Opening or closing it therefore doesn't trip the unsaved-changes guard (DR-79). `/admin/users`
redirects to the overlay so earlier links work.
**Context:** Users is reached from the user menu on every admin page, usually for a quick look
or change, after which the Admin wants to be back where they were. As its own route it replaced
the page — losing scroll and in-progress edits, and returning only by the browser's back.
**Alternatives:** Keeping `/admin/users` as a route drawn as an overlay, with close going back —
simpler, but the page underneath reloads (losing scroll and edits, and asking to discard unsaved
template changes on the way in). Overlay state outside the URL — not linkable, and back
wouldn't close it.

### DR-85 — Home asks before any of its unsaved settings are lost

**Decision:** Home's unsaved-changes guard (DR-79) covers every setting Home saves — name, dates,
payments, pricing, template values and both templates — compared with the event as last loaded
or saved. After a save, the page takes the saved event from the server's reply, so a value the
server writes differently (a date) doesn't read as changed.
**Context:** DR-79 guarded only Home's two templates and left the other fields "for when it's
asked for"; it was asked for. Home's settings sit on one form with one Save, so losing a date
change is as easy as losing a template edit.
**Alternatives:** Keeping the guard to templates (DR-79) — what let other edits be lost silently.
Saving Home's fields as they change — no draft to lose, but a half-typed date or price would
take effect at once.

### DR-86 — The variable spec documents the methods of Python values

**Decision:** The variable spec (DR-36) describes the Python value types templates see —
`string`, `number`, `money`, `date`, `datetime`, `dict` and `list` — as `builtin` types whose
fields are a curated selection of their read-only methods, each with its signature and result
type. A type may name a `base` whose methods it also has: every Camphoric object and
event-specific type has `base: dict`, and a `list<T>` has the methods of `list`. The editor
offers inherited methods after a type's own fields and resolves `.name` to a method before a
key, as Jinja does. A rendered method — what a forgotten `()` or a key named like a dict method
(`camper.attributes.items`) prints — is reported as a warning. Server tests check every listed
method exists, is callable or not as described, and passes the sandbox on sample values, and
that no Camphoric object field shares a name with a dict method.
**Context:** Templates could call many methods (`.split()`, `.get()`, `.items()`,
`.is_zero()`) that autocomplete, hover and Template Help never mentioned; typing `.` after text
or a list suggested nothing, and type inference stopped at any method call. A form question
named `items` silently printed `<built-in method items …>`.
**Alternatives:** Listing every method Python offers — long, and most (`quantize`,
`expandtabs`, `fromkeys`) are useless or confusing in a template. Copying the dict methods into
each object type's fields — repeated in every type and the payload, and it breaks the drift
test that each object's fields equal its graph keys. A separate `methods` list per type — still
repeated for every object type, where one `base` says it once. Warning on any use of a dict
method name as a key — the method is sometimes what's meant; printing it never is. Flagging
calls to methods the spec doesn't list — they work, so a warning would be noise.

### DR-87 — Every payment belongs to an invoice

**Decision:** Money owed, paid and given back is kept as invoices and payments (§9.7). An invoice
asks for one chunk of a registration's balance: an `amount`, plus a `handling` fee once it's paid
online — one amount, not line items. Every payment belongs to exactly one invoice, which can
hold several payments and refunds; a payment recorded without one goes on the oldest invoice with
money due, or a new "Payment received" invoice for exactly it, whose amount follows its payments.
An invoice's status is worked out from its payments, never stored. The registration's own payment
fields (`initial_payment`, `payment_type`, `paypal_response`) are gone; templates still get them,
worked out from the registration invoice, so older templates keep working.
**Context:** The first payment was split between the registration (the amount the registrant
chose, in a JSON field) and the payments (only for PayPal, only when verifying it worked), and
admin balances read only payments, so a check registrant's balance and `initial_payment`
disagreed. Billing someone after the fact (#670), a second payment or a meal plan added later
(#353) and switching from check to PayPal (#623) all need a "this is what's asked" record apart
from "this is what was paid".
**Alternatives:** Line items on each invoice — every real invoice is "Registration balance" or "50%
Deposit" plus at most the fee, so a table of lines was overhead; charges belong on the price
(custom charges, overrides). A stored status — drifts when a payment is deleted or restored.
Payments optionally on an invoice — two kinds of payment, and the fee would have nowhere to go.
Keeping `initial_payment` alongside invoices — two records of the same thing.

### DR-88 — The handling fee is charged on each payment made online

**Decision:** The e-payment handling fee isn't part of the price. It's the event's percent of
an invoice's amount still due, to the cent, a half cent up, added to that invoice when it's paid
online (by the server, when it captures the PayPal order); paying by check adds none, and a
deposit paid online carries a fee on the deposit only. Registrars change it on the invoice, and
the admin's "Calculate" suggests it the same way (a small client `handlingFee` kept in step with
the server by shared rounding cases). Supersedes DR-78 and amends DR-56.
**Context:** On the total, the fee was charged in full on a deposit paid online and couldn't be
charged on a second payment, nor added when a check registrant paid by PayPal after all (#623);
it was also decided before the payment method was known (#675). DR-78 had rejected per-payment
fees as "closer to what PayPal charges, but it reworks payments" — invoices (DR-87) are that
rework.
**Alternatives:** Keeping the fee in the price with an override (DR-78) — the problems above.
A fee per payment rather than per invoice — a second online payment on one invoice would need
its own fee; one fee per invoice, on what it asks, is what the payer sees.

### DR-89 — The server works out the payment options

**Decision:** The registration step returns the event's deposit choices as payment options with
amounts worked out on the server (json-logic over the stored pricing results, within 0 and the
total), each with its online handling fee. The payment step posts the option's name; the
browser never computes an amount. Closes the gaps of #675 together with DR-90.
**Context:** The deposit was computed only in the browser and its total stored unchecked as
`initial_payment.total`; the check total was a second client pricing run (#675).
**Alternatives:** Evaluating in the browser and checking on the server — two evaluators to keep in
step for no gain, since the browser only displays the result.

### DR-90 — The server creates and captures PayPal orders

**Decision:** PayPal's buttons ask our server to create the order (the `paypal-order` step) and,
on approval, hand the order id back; the server checks the order is for this invoice and for
what it asks now, and captures it. Each order has one item, "Total for Invoice #{id} for {Event
Name}". A capture is recorded by its PayPal capture id (`paypal_transaction_id`, unique); an order
found already captured is recorded or returned, never captured twice. When PayPal's answer is
lost, the order stays pending on the invoice, the event's address gets the details, and
"Check PayPal order" settles it. Amends DR-77 only in where the order comes from: PayPal's card
button stays.
**Context:** The browser created the order for an amount it computed and captured it itself; the
server checked afterwards and, when the amount was wrong or PayPal unreachable, could only log
it ("fail open") — money was taken that the server couldn't confirm (#675). The order's item has
to name the invoice, which must exist first.
**Alternatives:** The browser creating the order after the server prepares the invoice — less
change, but the browser still sets the amount and captures, so mismatches and unverifiable
captures remain. A server-side webhook from PayPal — more setup, and still needs the capture
on approval.

### DR-91 — A payment button completes the registration

**Decision:** Pressing a payment button — Pay by check, PayPal or Card, or Finish registration
when nothing is owed — completes the registration: it's in the admin lists from then on, unpaid
until money arrives. A PayPal payment that doesn't go through leaves it completed and unpaid; the
registrant can try again (with another option, too), pay by check, or finish and pay later. The
confirmation email goes out when the flow reaches a result (check chosen, payment captured,
finished to pay later, nothing to pay) or, failing that, from the worker half an hour after
completion; once. The browser saves the payment step, so a reload resumes paying for the same
registration.
**Context:** A registrant who abandoned PayPal stayed incomplete — invisible to registrars, and
deleted after a month (DR-76), though they meant to register. Sending the email at the button
press would tell a PayPal payer "amount due" moments before their payment; sending it only on
success would leave someone who closed the tab with nothing.
**Alternatives:** Completing only once paid (as before). Emailing at the button press. Emailing
only when the flow succeeds.

### DR-92 — Existing payments become invoices, balances unchanged

**Decision:** Migration 0076 builds invoices from what's there: each completed registration's
`initial_payment` becomes its registration invoice (from its first payment, or its price, for a
registration from before `initial_payment` was kept), with a PayPal or card payer's handling fee
moved onto it from the price and the matching payment linked; every other payment goes where a
payment recorded now would — the registration invoice while it has money due, else an invoice of
its own (a "Refund given" one for a refund recorded as a negative payment); a fee with nowhere
else to go gets a `migrated` invoice. The fee leaves the stored price without repricing. It then
checks every completed registration's balance is what it was, and aborts if one isn't. Going back
rebuilds the old fields (`initial_payment` recomputed, not byte-identical).
**Context:** Lark's live data (2,076 completed registrations, 1,846 payments, $3,695.58 of kept
handling fees) converted with every balance unchanged, also after migrating back and forward.
**Alternatives:** Converting only new registrations — two payment models in the code until old
events are gone. Repricing every registration — date-based rules would drift.

### DR-93 — Only Admins delete payments and invoices

**Decision:** Deleting a payment or an invoice is for Admins. Registrars record payments and
refunds, edit, cancel and reopen invoices, and restore deleted payments. An invoice anything was
ever paid on can't be deleted, and a refunded payment can't be. Every role reads invoices,
internal notes included; Reporters change nothing.
**Context:** A payment is a record of money received; deleting one changes a balance without a
trace in the ledger. Cancelling an invoice is the everyday way to stop asking for money.
**Alternatives:** Registrars deleting too (as before) — the risk the rule addresses. Hiding notes
from Reporters — they read everything else.

### DR-94 — Refunds are negative payments, through PayPal when paid online

**Decision:** A refund is a payment with a negative amount on the invoice of the payment it gives
money back from (`refund_of`), never more than is left of it. A PayPal or card payment is
refunded through PayPal's refund API by Registrars and Admins — all or part — and recorded with
PayPal's refund id; a request id made once per attempt makes a retry refund once. Others are
recorded by hand. An overpaid invoice offers to refund the difference.
**Context:** Registrars refund overpayments and lowered invoices (a dropped meal plan), and paid
more than once by check; refunds were already being recorded as negative payments by hand,
untied to what they refunded, and PayPal refunds were made in PayPal's dashboard.
**Alternatives:** A separate refund model — a second kind of money record the ledger would sum
too. Recording only, with refunds still made in PayPal's dashboard — the two drift apart.

### DR-95 — Invoices are paid through an unguessable link

**Decision:** Every invoice has a random link code (`secrets.token_urlsafe(24)`) and a public
pay page at `/invoices/{code}`, with no sign-in. The page shows the event's name, the invoice and
the campers as first name and last initial — never the invoice's notes, the registrant's email or
the rest of the registration. It pays the invoice online through the same server-made PayPal
orders as the payment step (DR-90), adding the handling fee only when it's paid (DR-88). Its API
is open to anyone and throttled per client. A Registrar copies the link or sends it in the
invoice email. Resolves #670 and #623 (switching from check to PayPal adds the fee then).
**Context:** Registrants who chose a check, abandoned PayPal or owe more later had no way to pay
online; registrars took card payments by hand. A link in an email is how payers expect to pay a
bill. The link may be forwarded, so the page shows only what someone paying needs to recognize
the bill.
**Alternatives:** A registrant sign-in — Camphoric has no registrant accounts. The registration's
uuid as the link — it's already in the payment step's API and would expose the whole
registration. Showing the registrant's email and campers' full names — more than a forwarded link
should reveal.

### DR-96 — Registrars make and send invoices

**Decision:** Registrars and Admins make invoices by hand (origin `admin`): any amount, or the
balance no invoice asks for yet ("Registration balance"), with a memo for the payer and a due
date. They send one to the registrant with the event's invoice email — an email template that
comes with the event (purpose `invoice`, context `invoice_email`, with `invoice.pay_url`), edited
on Home — and every role can copy its pay link.
**Context:** Lark asks for a deposit at registration and the rest later, and registrars add
charges after registering (a meal plan). Those amounts need an invoice to be paid online (DR-95).
**Alternatives:** Only invoicing the whole balance automatically — registrars bill a part, or
ahead of a price change. A fixed, built-in invoice email — every other email is an editable
template (DR-45).

### DR-97 — The registration window is date and time, in the event's time zone

**Decision:** `registration_start` and `registration_end` are instants, not dates, and each event
has a `time_zone` (an IANA name). Admins pick and read the window as clock times in that zone,
whatever zone their browser is in, and the client sends ISO instants with an offset; the server
refuses a datetime without one. Registration is open from the start (inclusive) until the end.
A new event's zone is the server's template time zone (`CAMPHORIC_TEMPLATE_TIMEZONE`). When the
change shipped, every existing event was put in San Francisco's zone and its dates became
midnight there.
**Context:** Registration should open and close at a set time at camp, such as 2 PM, not at
midnight UTC (the night before, in California). The picker's value has no offset, and the
server read such values as UTC, so a time entered in the browser's zone was stored hours off,
and a date-only column couldn't hold the time at all. Admins don't all sit in the camp's zone.
**Alternatives:** One zone for every event from server settings — simpler, but camps elsewhere
couldn't use it, and the client would still need the zone from the server. Keeping dates and
fixing only the picker — registration still couldn't close at a time of day. Showing the window
in the viewer's zone (as other times are, DR-64) — an admin elsewhere would see and edit times
that aren't the camp's. Templates still format datetimes in the server's template time zone;
moving them to the event's zone is a separate change.

### DR-98 — The admin shows the server's release version

**Decision:** The server reports the release it runs at `GET /api/version`, from its
`CAMPHORIC_VERSION` environment variable, which release images set from their tag (without the
`v`). The organization and event choosers show it as `v0.12.0`, or "unknown version" when the
variable is empty or unset, as it is in development and in images that aren't releases.
**Context:** Admins and developers need to see which release a server runs, for example to
confirm a deploy or report a bug against a version.
**Alternatives:** Building the version into the client bundle — the client built in development
and the one in an image can't know which release the server is, and the server is the one
deployed by version. Adding it to whoami (`GET /api/user`) — that response is about the user and
is polled to keep the session alive. A public endpoint — nothing outside the admin shows the
version, so it isn't advertised to anyone signed out. Setting it to `dev` in development — one
more variable to keep in each development setup, for what "unknown version" already says.

### DR-99 — Choosing a dropdown's chosen option keeps it

**Decision:** In form dropdowns, choosing the option that's already chosen keeps it. An
optional dropdown is cleared with its own clear control; a required one has none.
**Context:** The dropdown's default emptied the field when its chosen option was chosen again.
On a phone, opening a pre-answered dropdown (Camp Harmony's "first time at camp", answered "No"
by default) and tapping the answer to close it left the field blank, and as the field wasn't
required, the registration went through without an answer.
**Alternatives:** Making every such field required in each event's schema — it fixes only
those fields, and an optional answer was still lost by a tap. Keeping the deselect and adding
nothing — there'd be no way to tell an answer was cleared on purpose.

### DR-100 — The colour scheme follows the operating system

**Decision:** The client takes its light or dark scheme from the operating system's preference,
and uses light where none is reported.
**Context:** The client was always dark. Registrants and admins whose systems are set to light
got a dark page anyway, unlike the other sites they use. Browsers report the system preference,
and the UI kit can follow it, switching live, with no other change: every screen already works
in both schemes.
**Alternatives:** Always dark (the old behaviour) or always light — either ignores what the
person has asked for. Dark where no preference is reported — it keeps the old look for the few
browsers that don't report one, but needs its own check on top of the UI kit's.

### DR-101 — Light, Dark or System, remembered in the browser

**Decision:** Every page offers Light, Dark and System, with System the default. The choice is
kept in the browser's local storage.
**Context:** Following the operating system (DR-100) is the right default, but some people want
the other scheme for this site alone — a registrant reading a long form, an admin on a shared
screen. Registrants don't sign in, so the choice can't live with an account; the browser is
the one place every visitor has. Keeping System as a choice means overriding it isn't a one-way
door.
**Alternatives:** A two-way light/dark flip — the first use locks in a scheme, and there's no way
back to following the system short of clearing the site's data. A setting saved with the admin's
account — follows them between devices, but registrants have no account, and it would need a
server change for little gain.

### DR-102 — Form actions stick to the bottom of what scrolls the form

**Decision:** Every admin screen and dialog where something is edited and saved puts its
actions in one shared action area. It sticks to the bottom of whatever scrolls the form — the page, or the dialog's
body — while keeping its own place after the last field, and says when the screen's edits are
unsaved where the screen tracks that. Fields reached with the keyboard scroll to stop above it.
**Context:** Most screens put Save after the form (#757). On a long one — Home, or a schema in
Settings — the admin scrolled to the end to save, and only there learned whether anything was
unsaved. The registration and camper editors already pinned their actions below a scrolling
section; the other screens didn't. A sticky area stays in the flow, so scrolled to the end it
covers nothing, and on a phone it costs one row at the bottom of the screen. A dialog's title
already sticks to its top the same way.
**Alternatives:** A bar fixed to the bottom of the window — always over the last field unless
every page reserves room for it, and outside a dialog rather than in it. A second Save at the
top — two of the same button, and the one by the fields still scrolls away. A floating Save
button — covers content on a phone, and leaves Cancel and Delete at the end. Each screen
arranging its own — how the screens came to differ.

### DR-103 — The camper record sets the days present, saved with the camper

**Decision:** The camper record's lodging section (DR-72) ticks off the days a placed camper is
present, as checkboxes the admin can change; the camper's Save sends the new `stay` with the
rest of its edits, and leaves it out when unchanged. A camper not yet placed has none to set.
**Context:** The old client's camper editor set the stay with a checkbox for each night, and
organizers asked for it back: a change of plans is usually handled from the camper's record, not
by finding their bar on the timeline. Sending the stay only when it changed means saving the
camper's answers doesn't undo a move made on the lodging screen meanwhile, nor drop departure day
from an older stay that has it (DR-65) unless the days were edited.
**Alternatives:** Keeping the section read-only, as DR-72 had it — the timeline can resize a bar,
but not leave a gap in a stay. A Save of its own for the days, as the old client had — two Saves
in one record, and a change made in one tab lost by saving the other. Setting days for an
unplaced camper — a stay without a unit isn't shown anywhere, and placing one sets its days
anyway.

---

## Appendix A — Backend / API Dependencies

What this (frontend) spec assumes from the Django backend. Per the project's API-editing rule,
the frontend cannot change these unilaterally — the items marked **needs change** / **future**
must be coordinated with the backend. Grouped by status.

### A.1 — Exists today; frontend depends on it staying stable (contract)

- **Roles:** `role` and `must_change_password` on `GET /api/user` and the login response, and the
  role rules on every admin endpoint (§5, §6; DR-50).
- **Users, organizations and passwords:** `/api/users/` with its actions, organization writes for
  Admins, `POST /api/user/password`, `/api/password-reset` and
  `/api/password-reset/{uid}/{token}`, and the `password_change_required` 403, with the shapes in
  §5 (§8.1, §8.10; DR-50, DR-52).
- **Pricing overrides:** `/api/pricingoverrides/` and `overridden` in pricing results, with the
  shapes in §5 (DR-56).
- **Deletes:** `GET /api/{entity}s/{id}/delete-preview/`, the 409 `{ detail }` when something
  keeps a delete from happening, and the delete rules, with the shapes in §5 (DR-54).
- **Invitations and campers:** `register_link` on invitations, and creating a camper on an
  existing registration (`POST /api/campers/`), with the shapes in §5 and §8.4.
- **Soft delete:** the restore and deleted-list endpoints for registrations, campers, payments
  and promo codes, and `registration_deleted` on invitations, with the shapes in §5 (DR-55).
- **Promo codes:** `/api/promocodes/`, `POST /api/events/{id}/checkpromo`, `hasPromoCodes` and
  `promoCode` on the register endpoint, `promo_code`/`promo` on registrations, and the `promo`
  pricing line, with the shapes in §5 and §9.2 (DR-67).
- **Change history:** `GET /api/registrations/{id}/history/` and `GET /api/campers/{id}/history/`
  with the shape in §5 (DR-53); `GET /api/users/{id}/history/` — what a user changed, paginated
  (DR-80).
- **Auth & bootstrap:** `GET /api/set-csrf-cookie`, `GET /api/user` (whoami), `POST /api/login`,
  `POST /api/logout` (§3, §6; DR-9, DR-26).
- **Server version:** `GET /api/version` with the shape in §5, read from the server's
  `CAMPHORIC_VERSION` (§8.1; DR-98).
- **CRUD entities** over the DRF `DefaultRouter` with **trailing slashes** and `?field=`
  filtering (`DjangoFilterBackend`). The client fetches per-event sets via these filters
  (e.g. `?event=`, `?completed=1`) and does table ops client-side (DR-25). The entity field
  shapes in §5 must stay in sync with the serializers and the client's API types (§5, DR-27).
- **Registration/payment:** `GET`/`POST /api/events/{id}/register` — the `ApiRegister` config
  bundle (including `registrationErrorMessages`) and the `step: 'registration' |
  'paypal-order' | 'payment' | 'finish'` posts, with `paymentOptions`, the payment problem codes
  and the confirmation's `invoice` and `ledger` (§5, §7; DR-89, DR-90, DR-91).
- **Invoices, payments and refunds:** `/api/invoices/` with `cancel`, `reopen` and
  `check-paypal`, payments' `invoice`, `refund_of` and `new_invoice`,
  `POST /api/payments/{id}/refund-paypal/`, and the registration's ledger fields, with the
  shapes in §5 (§9.7; DR-87, DR-88, DR-93, DR-94). Making invoices (`POST /api/invoices/`,
  `POST /api/registrations/{id}/invoice-balance/`), sending one (`POST /api/invoices/{id}/send/`),
  `pay_url`, the event's `invoice_template` and the `invoice_email` context (§8.3, §8.4; DR-96).
- **Registration window:** the event's `registration_start`/`registration_end` as instants
  (written with an offset) and its `time_zone`, on the event and in `GET /api/eventlist` (§5,
  §8.3; DR-97).
- **Invoice pay page:** `GET /api/invoices/pay/{token}` and its `order` and `capture` posts, open
  to anyone and throttled (`invoice_pay`), with the shapes in §5 (§9.7; DR-95).
- **Validation messages:** the Event's `registration_error_messages` field, validated by the
  events serializer as `{ path: { keyword: message } }` with non-empty strings (§7.1, §8.8,
  DR-34).
- **Other endpoints:** `POST /api/reports/{id}/render` (§8.7), `POST /api/invitations/{id}/send`
  (§8.4; its Jinja-render 400, §5), `GET /api/eventlist` (§4), `GET /api/customcharges/{camperId}`
  (§5).
- **Email:** the email templates (`EmailTemplate`; the event's `confirmation_template` and each
  registration type's `invitation_template`) and their save-time checks, the confirmation-failure
  report to `confirmation_email_from`, the unsubscribe page and list, the group email endpoints
  (recipient fields, recipients, send, test, duplicate, batches with cancel and retry), the
  outbox (`emailmessages`, the queue, retry and cancel) and email accounts, with the shapes in §5
  (§8.3, §8.8, §8.9; DR-44 to DR-48).
- **Server-rendered templates:** the Report's `variables_source` field, and
  `GET /api/events/{id}/templates/describe`, `POST …/templates/preview` and
  `GET …/templates/check` with the shapes in §5 (§8.7, §9.3, §9.6; DR-35, DR-36, DR-37).
- **Server-authoritative pricing:** the server recomputes and returns `serverPricingResults`,
  which the client adopts (§5, §11).
- **Nightly clean-up:** the task worker deletes incomplete registrations nobody has changed in
  30 days (§9.3; DR-76).

### A.2 — Needs a backend change (coordinate)

- **Session keep-alive config (DR-26):** `SESSION_SAVE_EVERY_REQUEST = True` with a suitable
  `SESSION_COOKIE_AGE`, so normal activity and the proactive checks slide the session expiry.
  Confirm `GET /api/user` is cheap enough to poll and that hitting it refreshes the session.
- **Verify `POST /api/logout`** exists and behaves (clears the session, reports logged-out). A
  `LogoutView` appears to exist — confirm path/behavior (DR-9).
- **Pricing-parity fixtures (DR-14):** a shared fixture set (inputs → expected `PricingResults`)
  plus a **server-side** test running them against `calculate_price`, so client/server parity is
  enforced in CI.

### A.3 — Future (with the plugin system, §14)

- `Plugin` and `PluginEvent` models + CRUD endpoints, and surfacing active plugins in the
  registration-config and admin-event payloads. Possibly server-side plugin hooks (open
  question, §14.10).

### A.4 — Explicitly **not** required (don't add speculatively)

- **Server-side table sort/ordering/pagination params** — not needed for V1; admin tables run
  client-side over the per-event set (DR-25). Becomes A.2 only if events ever reach many
  thousands of records.
- **Token/JWT auth** — not used; session auth + CSRF is the model (DR-26).

### A.5 — Client configuration (environment, not backend endpoints)

- **`VITE_API_PROXY`** — dev-server proxy target for `/api` (§2).
- **Google Maps API key** — a client env var for address autocomplete (DR-23); optional (no key
  ⇒ plain address inputs).
- **PayPal client id** comes from event config (`paypal_client_id`), not a client env var.

> **Watch item (not a hard dependency):** the camper list (the largest) is fetched whole (DR-25).
> Measured at **~60 KB gzipped for 497 campers** (≈ **~85 KB at 700**) — comfortably fine. Only
> if events ever grew an order of magnitude larger would a lighter backend list projection
> (preferred over pagination) be worth it.


---

## Appendix B — Suggested Build Order

> **Non-normative.** This is suggested sequencing to help kick off implementation, not a
> requirement. The spec body defines *what* to build; this only proposes an order. Adjust
> freely.

The ordering front-loads the shared, highest-leverage pieces (the form and pricing engines) and
the foundations everything else depends on. Each step lands with its own tests (§11, DR-28) — the
Playwright e2e in step 6 is the *final* coverage layer, not the point at which testing begins.

1. **Scaffold & foundations.** Vite + TypeScript + Mantine (CSS Modules + PostCSS) + ESLint/
   Prettier + the dev `/api` proxy. App bootstrap: the CSRF → user gate (§3) before the router
   mounts. Routing shell with the public/admin split and the auth guard (§4, §6).
2. **Data layer.** The imported `api-types` module (§5, DR-27) and the `createEntityHooks`
   factory over TanStack Query (§5); the global error/notification plumbing (DR-10) and the
   session lifecycle — logout, reactive 401, proactive monitoring/re-auth (DR-9, DR-26).
3. **Shared engines (highest leverage).** The form engine — rjsf v6 + `@rjsf/mantine` + the
   custom fields/widgets/templates (§9.1); and the pricing engine `calculatePrice` with its
   shared parity fixtures wired into CI (§9.2, DR-14). The templating/markdown pipeline (§9.3).
4. **Public registration flow.** Steps 1–3 — form (live pricing, localStorage persistence) →
   payment (check / PayPal / deposits) → confirmation (§7). This exercises the form + pricing +
   templating engines end-to-end early.
5. **Admin application.** The event-admin shell (navigation, §8.2), then the sections, simplest
   first: home/settings (§8.3) → reports (§8.7) → registrations (§8.4) → campers (§8.5) →
   lodging (§8.6, the most custom — tree + assignment). Introduce headless TanStack Table (DR-19)
   and `match-sorter` (DR-20) with the first list.
6. **Cross-cutting hardening.** Accessibility, responsive targets (DR-17), error boundaries,
   the Playwright e2e over registration→payment→confirmation (the final coverage layer on top of
   the unit/component tests written in each prior step — DR-28), and bundle posture
   (lazy-load Monaco — admin/reports only).
7. **Deferred / future (not V1):** the plugin system (§14) and the items in §13 (deposits UI,
   invitation link, dual-pricing exploration) and `TODO.md`.
