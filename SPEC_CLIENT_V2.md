# Camphoric Client (Frontend) — Specification

**Status:** Living draft for the V2 client rebuild — see §15 (Decision Records) for the
decision history.
**Last updated:** 2026-09-26

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
- §15 — Decision Records (DR-1…DR-47)
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

---

## 1. Goals and Scope

- Render fully data-driven registration forms from server-provided JSON Schema, with custom
  field types specific to camp registration (multiple campers, addresses, lodging requests).
- Compute registration pricing **client-side in real time** as the user edits the form, using
  server-provided pricing logic, while keeping the result identical to the server's
  authoritative calculation.
- Support multiple payment methods (pay-by-check and PayPal/credit card) with optional
  deposit options and electronic-payment handling fees.
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
  admin (single editor; see §15, DR-8).
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
`?registrationsTab`, Email's `?emailTab`, `?templateId`, `?messageId` and history
filters, and
Template Help's `?context`, `?helpTab`, `?topic`, `?q`) is typed and
centrally defined. (Rationale: §15, DR-2.)

The router defines two top-level branches. A trailing-slash normalizer redirects any URL
ending in `/` to the non-slash form.

### Public / registration routes (registration client store)

- `/` — splash/default page listing public events (open/closed status), with a link to admin.
- `/events/:eventId/register` — redirects to `…/register/registration` (preserving query
  string, which may carry an invitation code).
- `/events/:eventId/register/registration` — Step 1, the registration form.
- `/events/:eventId/register/payment` — Step 2, payment.
- `/events/:eventId/register/finished` — Step 3, confirmation.

The `eventId` is parsed from the URL by the registration API layer; the registration store's
queries derive it from `window.location` rather than props, through the routing library.

### Admin routes (behind auth guard)

- `/admin` and `/admin/organization/` — organization chooser.
- `/admin/organization/:organizationId/event` — event chooser for the org.
- `/admin/organization/:organizationId/event/:eventId/*` — the Event Admin container, which
  hosts the admin sections (see §10). Unmatched admin subpaths redirect to `…/home`.
- `/admin/organization/:organizationId/event/:eventId/email` — email (§8.9). Search params:
  `?emailTab` — `history`, or templates (the default, left out of the URL); `?templateId` —
  the group email template being edited (`new` for a new one); `?messageId` — the email open in
  the history; `?mstatus`, `?mkind`,
  `?mq`, `?mpage`, `?mbatch` — the history's status and kind filters (comma-separated lists),
  search text, page, and the group email send whose copies it shows.
- `/admin/organization/:organizationId/event/:eventId/template-help` — Template Help (§9.3).
  Search params: `?context` — the kind of template (`report`, `confirmation_email`,
  `confirmation_page`, `invitation_email`, `bulk_email_registration`, `bulk_email_camper`, `bulk_email_manual`;
  default `report`); `?helpTab` — `variables` (default), `syntax` (filters, tests and tags) or
  `guide`; `?topic` — the guide topic id; `?q` — the search text. Defaults are left out of the
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
- **Delete:** `DELETE /api/{entity}s/{id}/`.

Caching/invalidation uses query keys (one key namespace per entity, parameterized by the
filter params). Mutations invalidate the relevant entity key(s) so dependent lists refetch
automatically. Some mutations must invalidate **multiple** namespaces because they affect
derived data — e.g. updating a `Camper`, `CustomCharge`, or `Payment` must also invalidate
`Registration` queries (because totals/augmented data change).

Entities (each with the standard CRUD set unless noted): `Organization`, `Event`,
`Registration`, `RegistrationType`, `Report`, `Invitation`, `Lodging`, `Camper`, `Deposit`,
`Payment`, `CustomCharge`, `CustomChargeType`, `EmailAccount`, `EmailTemplate`, `User`.

Non-CRUD admin endpoints:

- `GET /api/user` — current user (whoami).
- `POST /api/login` — `{ username, password }`, invalidates whoami.
- `POST /api/reports/{id}/render` — render a Jinja report → `{ report: string, error: string |
  null, diagnostics? }`. The body depends on the report's `variables_source` (§8.7): legacy
  (`client`) reports post the template-variable bundle; `server` reports post `{}`, render from
  the server's own variables, and add `diagnostics` (the `TemplateDiagnostic` list below);
  `report` is empty when there's an error.
- **Server-rendered templates** (§9.3, §9.6; all admin-only):
  - `GET /api/events/{id}/templates/describe` → the **variable spec** (§15, DR-36):
    `{ contexts, types, filters, tests, tags, globals }`. `contexts` maps each kind of template
    (`report`, `confirmation_email`, `confirmation_page`, `invitation_email`,
    `bulk_email_registration`, `bulk_email_camper`, `bulk_email_manual`) to `{ title, doc, roots, sample }`, where `roots`
    are its variables and `sample` names the kind of record a preview renders for
    (`registration` | `camper` | `invitation` | null). `types` maps a type name to
    `{ doc, fields }`. A field (and a root or global) is `{ name, type, doc, example?,
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
    registration_id?, camper_id?, invitation_id?, registration_type_id? }`. Response:
    `{ output, subject?, html?, diagnostics, truncated, duration_ms, sample: { kind, id, label }
    | null }` (`html` is the `email` body rendered from markdown). Without a sample id, the first
    completed registration/camper/invitation is used. An unknown context or output, or a sample
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
    earlier recipient) and `filter_error` (an expression failed for it); a bad rule or expression is a diagnostic on its field
    (`filter`, `filter_expression`, …).
  - `POST /api/emailtemplates/{id}/send/` `{ recipient_keys, account?, from_email?, reply_to?,
    skip_already_sent? (default true), send_at? }` — send a `group` template to the reviewed
    recipients, now or at `send_at` (ISO 8601; later needs the email worker) → 202 with the
    `EmailBatch`. A 400 `{ detail }` when no recipients are given or the template isn't a group
    email. The copies are rendered when the batch is prepared: a recipient no longer in the data
    is skipped as `gone`, one the template already reached as `already_sent` (unless
    `skip_already_sent` is false), and a copy that can't be rendered is a `failed` message.
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
- `GET /api/eventlist` — public list of events for the splash page.

### Registration API (public)

- `GET /api/events/{eventId}/register{?invitation/query}` → `ApiRegister` config bundle
  (schemas, ui schema, pricing logic, pricing vars, template vars, event subset, optional
  invitation/registration-type info, PayPal options, pre-submit template, and
  `registrationErrorMessages` — the event's custom validation messages, `{}` when it has none;
  §7.1).
- `POST /api/events/{eventId}/register` with `{ step: 'registration', formData,
  pricingResults, invitation? }` → payment-step payload
  (`{ registrationUUID, serverPricingResults, deposit }`).
- `POST /api/events/{eventId}/register` with `{ step: 'payment', registrationUUID,
  paymentType, paymentData, payPalResponse? }` → confirmation-step payload
  (`{ confirmationPage, serverPricingResults, initialPayment, emailError }`), where
  `confirmationPage` is the event's confirmation page already rendered on the server, as
  markdown (§7.3). The confirmation email is queued, not sent, before the response (§15, DR-44):
  `emailError` is true only when it couldn't be queued (its template can't be rendered, or the
  address can't be emailed). Repeating the payment step for a registration that's already
  complete returns the same payload and records no second payment or email.

> **Server is authoritative.** The client sends its locally computed `pricingResults`, but the
> server recomputes and returns `serverPricingResults`, which the client uses thereafter.

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

- **Organization:** `id`, `name`, timestamps.
- **Event:** `id`, `name`; `registration_start`/`registration_end` (window); `start`/`end`
  (event dates); `default_stay_length`; JSON Schemas: `camper_schema`, `camper_admin_schema`,
  `registration_schema`, `registration_ui_schema`, `registration_admin_schema`,
  `payment_schema`, `deposit_schema`; `pricing` (named numeric vars);
  `camper_pricing_logic` / `registration_pricing_logic` (JSON Logic component lists);
  `registration_template_vars`; `registration_error_messages` (custom validation messages,
  `{ field path: { validation keyword: Handlebars message } }`, §7.1);
  `confirmation_page_template` (a Jinja markdown template, §7.3; saving one that doesn't parse
  is refused with a 400 `{ confirmation_page_template: ['Line N: message'] }`);
  `confirmation_template` (read-only: the id of the confirmation email's `EmailTemplate`, created
  with the event, §8.3) and `confirmation_email_from` (the event's sending address);
  `paypal_enabled`, `paypal_client_id`, `epayment_handling` (percent); `organization`.
- **Registration:** `id`, `attributes` (registrant form data), `admin_attributes`,
  `registrant_email`, `server_pricing_results`, `client_reported_pricing`, `event`,
  `registration_type`, `payment_type`, `paypal_response`, `uuid`, timestamps.
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
  `event`, `purpose` (`confirmation` | `invitation` | `group`), `name`, `subject` and `body`
  (Jinja; the body is markdown), `from_email` (blank: the event's `confirmation_email_from`),
  `reply_to` (blank: the sending account's default), `account` (null: the event's account),
  timestamps. Saving one whose subject or body doesn't parse is refused with a 400
  `{ subject | body: ['Line N: message'] }`. Only `group` templates can be created or deleted
  (the confirmation and invitations come with their event and types; deleting one is a 409), and a
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
  `cancelled`; `done` is sending with nothing waiting).
- **Invitation:** `id`, `registration?`, `registration_type?`, `invitation_code`,
  `recipient_name`, `recipient_email`, `sent_time?`, `expiration_time?`, and read-only `email`:
  the latest invitation email's delivery, `null | { id, status, error, queued_at, sent_at }`.
- **EmailAccount:** `id`, `organization`, `name`, `backend`, `host`, `port`, `security`
  (`starttls` | `ssl` | `none`), `timeout`, `username`, `max_per_minute?`, `max_per_day?`,
  `default_reply_to`, and `password`, which is write-only (stored encrypted; blank on an update
  keeps it); read-only `password_status` is `set` | `unset` | `unreadable` (the encryption key
  changed, so it must be entered again).
- **EmailMessage:** `id`, `event?`, `kind` (`confirmation` | `confirmation_report` |
  `page_report` | `invitation` | `bulk` | `test`), `registration?`, `invitation?`, `account?`,
  `account_name?`, `from_email`, `to`, `reply_to`, `subject`, `text`, `html`, `status`
  (`queued` | `sending` | `sent` | `failed` | `cancelled`), `attempts`, `next_attempt_at`,
  `last_error`, `sent_at?`, `smtp_message_id`, `created_by?`, `created_by_name?`, timestamps.
- **Lodging:** `id`, `event`, `parent`, `name`, `children_title`, `capacity`, `reserved`,
  `visible`, `sharing_multiplier`, `notes`.
- **Deposit:** `id`, `event`, `deposited_on`, `attributes`, `amount`.
- **Payment:** `id`, `registration`, `deposit?`, `payment_type`, `paid_on`, `attributes`,
  `amount`, `notes`.
- **CustomCharge / CustomChargeType:** charge has `camper`, `custom_charge_type`, `amount`,
  `notes`; type has `event`, `name`, `label`.
- **User:** standard Django user fields (`username`, `email`, names, `is_staff`, etc.); an
  anonymous user has `username: ''` and `id: null`.

The client also derives **augmented** view models that a V2 should reproduce (in selectors or
hooks):

- **AugmentedRegistration** = registration + `campers[]` (its campers) + resolved
  `registrationType` + `total_owed` (from `server_pricing_results.total`) + `total_payments`
  (sum of its payments) + `total_balance`.
- **AugmentedLodging** = lodging + `children[]` (nested) + `isLeaf` + `campers[]` (assigned
  here) + `count` (campers in subtree) + `capacity` (explicit, or sum of children) +
  `maxCapacity` + `fullPath` (e.g. `Building A→Room 101`) + `pathParts`.

---

## 6. Authentication

- The admin guard requires a non-empty `username` on the current user. Anonymous users see a
  **Login** form (username/password) that posts to `/api/login`; on success the whoami cache
  is invalidated and the guarded content renders.
- The registration flow needs no authentication, but an **invitation code** in the query
  string grants access to otherwise-closed registration and pre-fills invitation context.
- A **logout** action (`POST /api/logout`) clears the session. A global handler bounces a 401 on
  any admin endpoint back to the login form, preserving the attempted URL; a 401/403 on a
  registration submit surfaces a friendly error. Per-object/org authorization is enforced by the
  server — the UI renders what the API returns and handles 403s gracefully (see §15, DR-9,
  DR-12).
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
to `{ campers: [{}] }`), `totals` (PricingResults), optional `paymentStep`, `paymentInfo`,
`confirmationStep`, and an `updating` flag.

Before any step renders, the app loads the registration config (`GET …/register`) and:
- indicates loading while it fetches;
- if the event is not currently open **and** there's no invitation, presents a
  registration-closed message;
- otherwise sets the document title, surfaces invitation context when an invitation/type is
  present (and any invitation error), then shows the current step.

### 7.1 Step 1 — Registration form

- Renders a JSON Schema Form from `config.dataSchema` + `config.uiSchema` with the in-progress
  `registration` as form data.
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
  handling-charge notice (computed from `epayment_handling`) and the server-provided
  `preSubmitTemplate` (rendered through the template engine). An action advances the registrant
  to payment.
- **Submit:** posts `{ step: 'registration', formData, pricingResults, invitation? }`. On
  success it stores the returned payment-step payload and advances to the payment step.

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
pricing components (plus the e-payment handling fee when present) and the grand total; each
camper section lists that camper's components and its total. Labels come from the pricing
logic's `label`s (§11).

Then reads the payment-step payload's `serverPricingResults.total`:

- **No payment needed** (total ≤ 0): complete the flow without collecting payment.
- **Payment needed** (total > 0): the registrant chooses how to pay; the surface must support:
  - **Deposit options:** if the payment step includes a `deposit` schema, let the registrant
    choose among deposit options. Each choice carries a JSON Logic expression; selecting one
    recomputes the amount due by applying that logic to the pricing results (so the displayed
    total updates live). The default deposit option is pre-selected.
  - **Pay by check:** recomputes totals with payment type `Check` (i.e. **without** the
    e-payment handling fee), applies the chosen deposit logic, and posts the payment.
  - **PayPal / credit card:** offer PayPal / credit-card payment via the PayPal SDK. The order's
    amount is the current total; the chosen deposit name is embedded in the order's `custom_id`
    (the only reliable way to recover the deposit choice in the approve callback). On approval it
    captures the order, derives payment type (`PayPal` vs `Card` from the funding source), reads
    the captured amount and deposit, and posts the payment.
  - While a payment is in flight, block further interaction and indicate progress (and prevent
    double submission).
- **Posting a payment:** `{ step: 'payment', registrationUUID, paymentType, paymentData:{ type
  (deposit name), total }, payPalResponse? }`. On success it stores the confirmation-step
  payload and navigates to the confirmation step. If the payment step data is missing, it
  redirects back to step 1.

### 7.3 Step 3 — Confirmation

- Shows the confirmation page the server rendered for this registration
  (`confirmationStep.confirmationPage`, markdown), through the sanitizing markdown pipeline
  (§9.3). The client does no templating here (§15, DR-42).
- The page is the event's `confirmation_page_template`, a Jinja template rendered on the server
  when the payment step completes, with the confirmation email's variables (the
  `confirmation_page` context: `event`, `registration`, its `campers`, `pricing`,
  `initial_payment`). If it can't be rendered, the registration still completes, the registrant
  sees a short generic thank-you, and a report with each problem is emailed to the event's
  `confirmation_email_from` address.
- Clears the saved localStorage form data (unless the keep-data debug flag is set).
- If there's no confirmation data (e.g. direct navigation/refresh), redirects to step 1.

---

## 8. Admin Application

### 8.1 Choosers

- **Organization chooser:** lists organizations; selecting one navigates to its event chooser.
- **Event chooser:** lists events for the org; selecting one navigates into the Event Admin
  container for that event.

### 8.2 Event Admin container and navigation

The event-admin area provides navigation among the event's admin functions, indicating the
current one and showing the event/organization identity. The functions (each addressable at
`…/event/:eventId/<section>`, so they're linkable) are `home`, `registrations`, `campers`,
`lodging`, `reports`, `email`, `template-help`, `settings`; an unknown subpath falls back to `home`. (The routes are a
contract; the navigation's visual form is not.)

Within each function the admin typically **finds/selects a record and views or edits its
details**. Two cross-cutting requirements (the presentation is the implementer's call):

- **Selection is URL-addressable** — the selected record (and, for tables, the sort/filter/page
  state) lives in the URL so views are shareable, bookmarkable, and back/forward-friendly
  (e.g. `?registrationId=…`, `?camperId=…`, `?reportId=…`).
- **Data-heavy lists** (registrations, campers, invitations) support **sorting, filtering, and
  pagination** — handled client-side in the table over the full per-event dataset, which is small
  (≤~700 records; DR-19, DR-25); smaller lists need only lightweight client-side filtering
  (DR-20). Whether a record is reached via a side list, a
  master/detail split, a drawer, or full pages is left open.

### 8.3 Home / Event configuration

An interface to view and edit the event's top-level configuration; saving persists via PATCH to
the event:

- Event basics: `name`, `start`, `end`, `default_stay_length`.
- Registration window: `registration_start`, `registration_end`.
- **Confirmation page** — its message, a Jinja markdown template edited in the template editor
  (§9.6) with the `confirmation_page` context and a live preview for a completed registration
  (§7.3).
- **Confirmation email** — `from` (the event's sending address), and the email's subject and body
  (its email template, edited as described below and saved with the rest).
- PayPal: `paypal_enabled`, `paypal_client_id`, `epayment_handling`.
- `pricing` (a freely editable set of named integer values) and `registration_template_vars`
  (named string values).

Datetime fields use explicit timezone handling. (Exposing the underlying JSON is a useful
debugging aid.)

**Email templates** (the confirmation email here, and invitation emails, §8.4) are the event's
email templates (§5; §15, DR-45), written in Jinja: the subject and the markdown body render on the
server against the event's variables (§9.3). The body is edited in the template editor (§9.6) with
the email's context (`confirmation_email`: `event`, `registration`, `campers`, `pricing`,
`initial_payment`; `invitation_email`: `event`, `invitation`, `registration_type`), and the
preview renders subject and body exactly as they'd be sent, for a sample the admin can choose (any
completed registration; any of the type's invitations, or an example invitation when there are
none). Subject problems are listed with the body's; a template that doesn't parse can't be saved
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
sortable/filterable table — columns such as primary camper, registration type, balance, payment
status) and works with it. For the selected registration they can:

- **Edit core fields and attributes** — registration type, registrant email, and the
  schema-driven `registration_schema` attributes (rendered in admin mode, §9.5). Persists via
  PATCH `{ registrant_email, registration_type, attributes }`. The registration can be deleted
  (with a confirmation step).
- **Edit admin-only attributes** — assembled from `registration_admin_schema` (a map of named
  `{ data, ui }` schema pairs combined, ordered by title). Persists via PATCH `admin_attributes`.
- **Review fees and manage payments** — see the fee breakdown from `server_pricing_results`
  (labels from the pricing-logic vars) and Total Owed / Total Payments / Balance Due; see payment
  history (type, date, amount, `payment_schema` fields, notes); and record a payment
  (`registration`, `payment_type` ∈ Check/PayPal/Card/Voucher, `paid_on`, `amount`, dynamic
  attributes, optional `deposit`, `notes`).
- **See and reorder its campers** — listed by `sequence`, each linking to the camper function,
  with the ability to change their order (PATCH `sequence`).

(Exposing the raw record JSON is a useful aid.)

**Invitations and special registration types.** An interface to:

- **Invite a special registration** — choose a registration type and enter recipient name and
  email; this creates the invitation and sends it (`/invitations/{id}/send`). (The registration
  types themselves are created/edited in Settings, §8.8.) If the type's Jinja invitation can't be
  rendered, nothing is sent and the problem is shown (§5).
- **Track invitations** — a sortable/filterable list of the event's invitations (default newest
  first) showing name, email, type, sent status, and linked registration (if redeemed), with
  per-row resend/delete. Status is derived: `redeemed` (has a registration); otherwise from its
  latest invitation email (§15, DR-44) — `sending` (queued or being sent), `sent`, `failed` or
  `not sent` (e.g. a `@dontsend.com` address), with the reason for the last two; otherwise `sent`
  if it has a sent time (sent before email was queued), else `unsent`. While an invitation's email
  is on its way, the list refreshes every few seconds. A redeemed invitation links through to its
  registration.

### 8.5 Campers

The admin finds a camper (the campers list is a sortable/filterable table — columns such as
name, registration, lodging, accommodation/camp preferences) and works with the selected one:

- **Edit the camper** — `camper_schema` in admin mode (admin-transformed UI schema; includes
  `registration_schema.definitions` for referenced types). Persists via PATCH `attributes`. The
  camper can be deleted (with confirmation).
- **Edit admin-only attributes** — from `camper_admin_schema` (same pattern as registrations).
  Persists via PATCH `admin_attributes`.
- **Set the lodging stay** — show the current assignment (path, or "Unassigned") and let the
  admin choose which event days the camper is present (the days derive from event start/end).
  Persists via PATCH `stay` (the set of selected days).
- **Review fees and custom charges** — fee breakdown from the camper's `server_pricing_results`
  (labels via `camper_pricing_logic`); list custom charges (date, type, amount, notes) with the
  ability to add (`camper`, `custom_charge_type`, `amount`, `notes`) and remove them.

(Exposing the raw record JSON is a useful aid.)

### 8.6 Lodging

This function manages the event's **lodging hierarchy** and **assigns campers to lodging units
across date ranges**, with capacity visibility. Required capabilities:

- **See unassigned campers** — those not yet placed in a leaf unit — with the context needed to
  place them: name, requested lodging, sharing preference/partner, and comments.
- **Manage the lodging hierarchy** — view it as a tree showing, per node, occupancy vs. capacity
  (and reserved count), and create/edit/delete nodes. A node has: parent, name, a title for its
  children, capacity (0 ⇒ auto-sum of children), reserved count, visibility, and notes; for a
  non-leaf node the calculated capacity is shown.
- **Assign and schedule campers** — place a camper into a leaf unit and set the **days they're
  present** (`stay`), and later move, reschedule, or unassign them. Assigning/scheduling persists
  via PATCH camper (`lodging`, `stay`); unassigning sets `lodging: null, stay: null`. A new
  assignment seeds its stay from the event's `default_stay_length`.
- **Inspect a camper in place** — requested lodging, sharing, registration type, attributes, and
  the registration's notes, with a quick unassign.

These must work efficiently across a whole event's campers and the event's date range. A
productive realization is a **calendar/timeline assignment view** — a column per event day,
campers shown as draggable/resizable bars spanning their stay, with unassigned campers dragged
in, and the ability to narrow the view to a branch of the hierarchy. If built that way, use
dnd-kit with day-column snapping and a custom resize handle (DR-6). The drag interaction is a
recommendation, not a requirement; what's required is the assign/schedule/unassign capability
and capacity visibility above.

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

**Legacy report template variables** (the bundle assembled client-side and passed to
render/Template): `event`, `registrations` (augmented) + `registrationLookup`, `campers` +
`camperLookup`, `lodgingLookup`, `registrationTypeLookup`.

### 8.8 Settings

An interface to edit the event's JSON configuration directly (in Monaco), each piece saving back
to the event via PATCH:

- Schemas: camper, registration, registration UI, deposit, payment.
- Pricing logic: camper pricing, registration pricing.
- Admin attribute schemas: registration admin attributes, camper admin attributes (each a map
  of named `{ data, ui }` pairs).

Registration types are also managed here: create/edit a type's machine `name` and `label`, and
its invitation email — subject and body, its email template (§15, DR-45), edited like the
confirmation email (§8.3) with the `invitation_email` context and a preview for any of the type's
invitations. A new type starts with a standard invitation, editable once the type exists. Types
persist via POST (new) / PATCH (edit) on `registrationtypes` (see §15, DR-32); the invitation via
PATCH of its template.

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
section shows **what the event's email is doing now**, the event's **email templates**, and its
**history**.

**Now** — how many emails are waiting (and when the next is tried) and how many failed in the
last day, refreshed every few seconds (every couple of seconds while email is waiting). Two things
hold email back, and each is explained when it happens:
- **No worker is running** — email is still queued and goes out once one runs again; the admin
  sees when a worker last reported in.
- **The sending account's limit is used up** — its email waits until a slot opens; the admin sees
  which limit (e.g. 500 in 24 hours) and when sending resumes. The short waits of a normal send
  kept to a per-minute limit aren't called out.

**History** — every email the event has queued, newest first: confirmations, invitations, group
email, the problem reports sent to the organizer, and tests. Each shows when, what kind, to whom,
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
  address gets one copy), or an expression that failed for that one. The count uses only the
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
  address, an expression that failed), with why, on request.
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
who's no longer in the event's data is skipped, and a copy that can't be rendered is recorded as
failed with the problem while the others still go.

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
  those for its `id`/`choices`) under the last dropdown.
- **Description** — renders schema/ui descriptions as templated markdown (via the Template
  engine and the form's `templateData`).

**Custom widgets.** The `@rjsf/mantine` base theme already provides the standard inputs —
including **Select** (enum with disabled options + value coercion), **Checkboxes** (inline +
disabled options), and text inputs with integer and datalist-examples support — so only the
genuinely additive widgets are layered on (§15, DR-29):
- **PhoneInput** — international phone entry (default country US), Mantine-native (§15, DR-30).
- **NaturalNumberInput** — digits-only non-negative integer.
- **Textarea** — overrides the base textarea to enforce `maxLength` truncation (guarding pasted
  or pre-filled overflow).

**Templates.** The base theme's templates render field layout, errors, help, arrays, and objects;
uiSchema options cover content-wrapper classes and array add/remove labels — so no custom Field/
Object/Array templates are needed (§15, DR-29). The one custom template is the **Description**
renderer (`DescriptionFieldTemplate`) noted above, which renders schema/uiSchema descriptions as
templated markdown via the Template engine and the form's `templateData`, plus an
`ErrorListTemplate` that omits errors hidden as noise (§7.1).

### 9.2 Pricing engine (`calculatePrice`)

A pure function computes a `PricingResults` object from the registration config and current
form data. **It must produce results identical to the server's `calculate_price`** (the
server remains authoritative; this is for live UX only).

Inputs: `config.event` (notably `epayment_handling`), `config.pricingLogic`
(`{ registration: [...], camper: [...] }`), `config.pricing` (named numeric vars),
`config.dataSchema` (to find camper date properties), the `formData`, and an optional payment
type.

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
   `results[var]` (running total across campers) and feed back into `data[var]`. Append the
   per-camper breakdown to `results.campers[]`.
5. **Handling fee:** if `event.epayment_handling` is set and payment type is **not** `Check`,
   add `results.total * epayment_handling/100` as `results.handling` and to `results.total`.

`PricingResults` is an open object (`total`, named subtotals, etc.) plus `campers: [...]` and
optional `handling`. All amounts are whole-dollar by convention (switch to cents if sub-dollar
precision is ever needed).

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
  `event`, `registrations`, `incomplete_registrations`, `campers`, `payments`, `lodging` (the
  root), `lodgings`, `registration_types`, `custom_charge_types`, `invitations`, `today` and
  `now`. `registrations`, `campers` and `payments` are those of completed registrations. A
  confirmation email — and the confirmation page — gets the one registration it's for
  (`registration`, its `campers`, `pricing`, `initial_payment`) and `event`; an invitation email gets `invitation`,
  `registration_type` and `event`; a group email's copy gets its recipient's registration or
  camper and `recipient` (§8.9).
  Relationships are resolved: `camper.registration`, `camper.lodging.full_name`,
  `registration.campers`, `lodging.all_campers`, `event.nights`, and so on. Money is a
  two-place decimal; dates and datetimes are real dates (datetimes in the server's configured
  template time zone).
- **The variable spec** — the describe endpoint (§5) publishes every context's variables, every
  type's fields (with docs and examples, including the event's own form questions and pricing),
  and the filters, tests and tags. It is the single source for the editor's autocomplete and
  hover (§9.6) and for help.
- **Read-only** — templates can't change Camphoric objects (no `.update()`/`.append()` on them),
  but can build their own lists and dicts (`{% set rows = [] %}`, `namespace`, `merge`).
- **Sandboxed, with limits** — templates run in Jinja's sandbox (no Python internals, no model
  methods), with a render time limit and an output-size cap (§15, DR-37). Legacy reports also
  render sandboxed.
- **Diagnostics** — a render never fails with a traceback: syntax errors, undefined values,
  sandbox refusals, timeouts and the output cap come back as `TemplateDiagnostic`s (§5) with
  their line (and column where known). Using a field that a Camphoric type doesn't have (a typo
  such as `camper.frist_name`) renders blank and is reported as a warning. The read-only
  refusal's message points authors to the *Computed values* guide, so that topic keeps its
  title.

**Template Help.** Template authors get in-app help in two places: beside the template editor
(§9.6), and on a standalone page (`…/template-help`, §4) reachable from the admin navigation
and linked from the editor's help. Both offer, for one kind of template:

- **Variables** — the context's variables, then every type reachable from them (nearest first),
  each field with its type, description, example, allowed values and whether it may be empty.
  Types link to their own entry; the event's own types (its form questions and pricing) are
  marked as such. Generated entirely from the variable spec (§5; §15, DR-36).
- **Filters, tests and tags** — each with its signature, description and example; Camphoric's
  own filters are listed first.
- **Search** across both, by name, title, type or description; a type whose name matches is
  shown whole.
- **Guides** — short topics: Jinja basics; loops, sorting and grouping; computed values (own
  lists and dicts, `merge`, `namespace`, macros); money, dates and CSV; lodging; common errors;
  moving from legacy reports (a mapping from the bundle's lookups to the linked variables);
  moving emails from Mustache (a mapping of each email's variables); and the Handlebars helpers
  (from the helpers' own help text).

Beside the editor, choosing a variable, field, filter, test or tag inserts it at the cursor
(`name`, `.field` or `['key']`, `| filter`, `is test`, or a tag snippet). The standalone page
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
  applicable. V2 standardizes on Monaco (drops `vanilla-jsoneditor`; see §15, DR-8).
- **Template editor** — the Monaco editor specialised for server-rendered Jinja (§9.3), used
  wherever such a template is written (server-source reports, §8.7). Given the event and the
  template's context, it provides (§15, DR-36):
  - **Jinja highlighting** — delimiters, comments, tags, filters, strings, numbers — with
    `{{ }}`, `{% %}` and `{# #}` auto-closed.
  - **Autocomplete from the variable spec** (§5) inside `{{ }}`/`{% %}`: the context's
    variables and globals; after `.`, the fields of the expression's type — following chains
    (`campers[0].registration.`), keys (`['key']`), loop and assignment variables
    (`{% for %}` with `loop`, `{% set %}`, `{% with %}`, macro parameters), and list filters
    (`| first`, `| sort`, `| selectattr`, `| map(attribute=…)`); after `|`, filters; after `is`,
    tests; after `{%`, tag snippets. Each suggestion shows its type and its doc/example. Keys
    that aren't identifiers are inserted as `['key']`; methods are inserted with parentheses.
    The event's own form questions sort first.
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

  Several template editors can be open at once, each with its own context.
- **Error boundary** — isolates failures in risky subtrees (the registration form, invitation
  context, report rendering); shows detail in dev, fails quietly in prod. (This one *is*
  architectural, not just visual.)
- **Object/JSON viewer** — read-only rendering of arbitrary objects, for the raw-record aids.
- **Inputs** — labeled text/number/textarea, a money input, and an editor for a freely editable
  set of key/value pairs.
- **Registration chrome** — the live price total, the per-step page framing, and the
  closed-registration / invitation context described in §7.

---

## 10. Cross-Cutting Concerns

- **Money:** formatted to two decimals; computed in whole dollars.
- **Dates/times:** Luxon (`DateTime`) with explicit timezone handling; form date values are
  `YYYY-MM-DD`, datetimes are ISO with offset. Camper `stay` is an array of `YYYY-MM-DD`
  strings. Pricing logic receives dates as `{ year, month, day }` objects. Watch UTC-vs-local
  boundaries (the previous grid header rendered day labels at a fixed UTC offset to avoid
  off-by-one shifts) — use `setZone`/`toISODate` deliberately rather than relying on the
  local zone.
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
  inline field errors on forms (§15, DR-10).
- **Data freshness & optimistic updates:** admin queries use a short `staleTime` and refetch on
  window focus; the registration config does not refetch on focus. Drag/reorder mutations
  (lodging assignment, camper `sequence`) are optimistic with rollback on error; other mutations
  invalidate-and-refetch (§15, DR-16).
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
  particular **Monaco** (load only when a report/schema editor opens), `@tanstack/react-table`,
  `dnd-kit`, and the reports/templating tooling. Keep the registration bundle to what the form,
  pricing, and payment flow actually need (PayPal's SDK loads at the payment step); admin code
  may be heavier but should still code-split per section.
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
  exist and pass (§15, DR-28). Tests (`*.test.ts(x)`), Ladle stories (`*.stories.tsx`) and test
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
- **E2E (Playwright):** component e2e drives the Ladle stories (the form engine, templating, the
  data table, and admin widgets) against a static Ladle build, plus a registration-flow smoke
  against the dev server; every test runs on desktop and two mobile devices (§15, DR-31). The
  registration smoke skips when no backend is reachable (as in CI).
- **Gates:** type-check, lint, unit tests and the e2e suite pass in CI (the *Client v2* workflow,
  on every push/PR that touches `client_v2/`) and in the pre-commit hook (§15, DR-15).

---

## 12. Behaviors to Preserve (and Pitfalls to Improve in V2)

These are subtle, load-bearing behaviors observed in the current client. Preserve the intent;
a V2 may implement them more cleanly.

- **Client/server pricing parity** is a hard requirement — divergence shows the registrant a
  different total than they're charged. Any change to `calculatePrice` must mirror the server.
- **Deposit choice round-trip through PayPal `custom_id`** — PayPal's flow loses the local
  deposit selection, so it's embedded in the order and recovered on approval. Keep a reliable
  mechanism for this.
- **Check vs. electronic totals differ** — paying by check omits the `epayment_handling` fee;
  recompute on payment-method choice, don't reuse the registration-step total blindly.
- **Separate server-state from client-state** — server data lives in TanStack Query (keyed by
  entity + filter params, across the two API roots `/api` and `/api/events`); the only global
  client store is the small Zustand store for the in-progress registration. Don't push cached
  server data into the client store.
- **Trailing slashes** on every admin API path are required by the backend.
- **localStorage rehydration keyed on schema title + event start** — clear it after
  confirmation; beware stale data across events.
- **Multi-key invalidation** for mutations that affect derived totals (`Camper`, `Payment`,
  `CustomCharge` → also invalidate `Registration` queries).
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

- **Deposits admin UI.** The `Deposit` entity and `deposit_schema` exist and deposits appear in
  the registration payment flow, but there's no admin screen to view/manage `Deposit` records.
  Deferred for V1 (deposits are created server-side on payment); revisit if organizers need to
  view/reconcile/batch deposits.
- **Invitation registration link in the UI.** Deferred — depends on the backend returning a
  `register_link` on invitations (a backend change out of scope here). When the API provides it,
  show a copy-link action in the invitation list and add `register_link?: string` to the
  `Invitation` type.

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
shifts; reproduce that intent rather than relying on the local zone.

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

### DR-31 — Playwright e2e: static-Ladle component suite + mobile projects

**Decision:** The Playwright e2e suite has two parts. The **component e2e** drives the **Ladle
stories** (the form engine, templating pipeline, data table, and admin widgets) served from a
**static `ladle build`** (not the dev server). A **registration-flow smoke** drives the Vite dev
server (which proxies to the Django backend) and skips gracefully when the registration config
can't load, so it stays green without a backend and never submits (creates no data). Every test
runs across three projects — **Desktop Chrome, Mobile Chrome (Pixel 5), Mobile Safari
(iPhone 13)** — exercising layouts responsively (DR-17).
**Context:** The Ladle stories already exercise the real components through their providers, so
they're the natural e2e render targets (DR-7) — no backend, fast, deterministic. Driving Ladle's
**dev** server proved flaky: Vite's on-demand per-story compile and dep-optimization reload made
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
pricing summaries come straight from `serverPricingResults`, labeled from the pricing logic.
**Context:** Events define arbitrary registration and camper fields, so the review can't be a
fixed layout. The same schema that rendered the form already carries titles, `enumNames` and
conditional structure; reusing it (and the same resolver the form engine uses) keeps the review
in lockstep with the form for every event with no per-event configuration. A per-event review
template would be a second thing to author and would drift from the schema.
**Alternatives:** A per-event Handlebars/Jinja "review template" (extra authoring, drifts).
Dumping the raw form data (unreadable enum codes and keys). Re-rendering the form read-only
(rjsf's `readonly` mode keeps widget chrome and empty fields, and is far noisier than a rundown).

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
Vitest (`src/**/*.test.{ts,tsx}`) and Ladle (`src/**/*.stories.*`) find them by glob, and a
Ladle story's id comes from its file name, so the e2e suite's story URLs are unaffected.
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

---

## Appendix A — Backend / API Dependencies

What this (frontend) spec assumes from the Django backend. Per the project's API-editing rule,
the frontend cannot change these unilaterally — the items marked **needs change** / **future**
must be coordinated with the backend. Grouped by status.

### A.1 — Exists today; frontend depends on it staying stable (contract)

- **Auth & bootstrap:** `GET /api/set-csrf-cookie`, `GET /api/user` (whoami), `POST /api/login`,
  `POST /api/logout` (§3, §6; DR-9, DR-26).
- **CRUD entities** over the DRF `DefaultRouter` with **trailing slashes** and `?field=`
  filtering (`DjangoFilterBackend`). The client fetches per-event sets via these filters
  (e.g. `?event=`, `?completed=1`) and does table ops client-side (DR-25). The entity field
  shapes in §5 must stay in sync with the serializers and the client's API types (§5, DR-27).
- **Registration/payment:** `GET`/`POST /api/events/{id}/register` — the `ApiRegister` config
  bundle (including `registrationErrorMessages`) and the `step: 'registration' | 'payment'`
  posts (§5, §7).
- **Validation messages:** the Event's `registration_error_messages` field, validated by the
  events serializer as `{ path: { keyword: message } }` with non-empty strings (§7.1, §8.8,
  DR-34).
- **Other endpoints:** `POST /api/reports/{id}/render` (§8.7), `POST /api/invitations/{id}/send`
  (§8.4; its Jinja-render 400, §5), `GET /api/eventlist` (§4), `GET /api/customcharges/{camperId}`
  (§5).
- **Email:** the email templates (`EmailTemplate`; the event's `confirmation_template` and each
  registration type's `invitation_template`) and their save-time checks, the confirmation-failure
  report to `confirmation_email_from`, the group email endpoints (recipient fields, recipients,
  send, test, duplicate, batches with cancel and retry), the outbox (`emailmessages`, the queue,
  retry and cancel) and email accounts, with the shapes in §5 (§8.3, §8.8, §8.9; DR-44, DR-45,
  DR-46).
- **Server-rendered templates:** the Report's `variables_source` field, and
  `GET /api/events/{id}/templates/describe`, `POST …/templates/preview` and
  `GET …/templates/check` with the shapes in §5 (§8.7, §9.3, §9.6; DR-35, DR-36, DR-37).
- **Server-authoritative pricing:** the server recomputes and returns `serverPricingResults`,
  which the client adopts (§5, §11).

### A.2 — Needs a backend change (coordinate)

- **Session keep-alive config (DR-26):** `SESSION_SAVE_EVERY_REQUEST = True` with a suitable
  `SESSION_COOKIE_AGE`, so normal activity and the proactive checks slide the session expiry.
  Confirm `GET /api/user` is cheap enough to poll and that hitting it refreshes the session.
- **Verify `POST /api/logout`** exists and behaves (clears the session, reports logged-out). A
  `LogoutView` appears to exist — confirm path/behavior (DR-9).
- **Invitation `register_link` (deferred, optional):** add a request-derived `register_link` to
  the invitation serializer so the admin can show/copy it; then the client adds
  `register_link?: string` to the `Invitation` type (§13.A).
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
