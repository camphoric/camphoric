# Camphoric Client (Frontend) — Specification

**Status:** Living draft for the V2 client rebuild — see §15 (Decision Records) for the
decision history.
**Last updated:** 2026-06-29

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
- §15 — Decision Records (DR-1…DR-27)
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
- **Pricing logic:** `json-logic-js` to evaluate server-provided pricing expressions.
- **Templating:** `handlebars` for variable substitution + a `unified`/`remark`/`rehype`
  markdown→HTML pipeline with sanitization.
- **UI kit:** Mantine (core + `@mantine/hooks`; `@mantine/dates` for date inputs,
  `@mantine/modals` for dialogs), with `@tabler/icons-react` for icons.
- **Payments:** PayPal JS SDK (`@paypal/react-paypal-js`).
- **Search:** `match-sorter` for lightweight client-side filtering/ranking of smaller admin
  lists (predictable starts-with → contains → acronym → fuzzy ranking). See §15, DR-20.
- **Data tables:** `mantine-react-table` (built on TanStack Table + Mantine) for sortable,
  filterable, paginated admin tables; fuzzy column/global filtering uses
  `@tanstack/match-sorter-utils`. Sort/filter/pagination run **client-side** over the full
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
`?registrationsTab`) is typed and centrally defined. (Rationale: §15, DR-2.)

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
`Payment`, `CustomCharge`, `CustomChargeType`, `User`.

Non-CRUD admin endpoints:

- `GET /api/user` — current user (whoami).
- `POST /api/login` — `{ username, password }`, invalidates whoami.
- `POST /api/reports/{id}/render` — render a report with supplied template variables →
  `{ report: string, error: string | null }`.
- `POST /api/invitations/{id}/send` — send/resend an invitation email.
- `GET /api/customcharges/{camperId}` — custom charges for a camper.
- `GET /api/eventlist` — public list of events for the splash page.

### Registration API (public)

- `GET /api/events/{eventId}/register{?invitation/query}` → `ApiRegister` config bundle
  (schemas, ui schema, pricing logic, pricing vars, template vars, event subset, optional
  invitation/registration-type info, PayPal options, pre-submit template).
- `POST /api/events/{eventId}/register` with `{ step: 'registration', formData,
  pricingResults, invitation? }` → payment-step payload
  (`{ registrationUUID, serverPricingResults, deposit }`).
- `POST /api/events/{eventId}/register` with `{ step: 'payment', registrationUUID,
  paymentType, paymentData, payPalResponse? }` → confirmation-step payload
  (`{ confirmationPageTemplate, serverPricingResults, initialPayment }`).

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
  `registration_template_vars`; confirmation page + email templates/subject/from;
  `paypal_enabled`, `paypal_client_id`, `epayment_handling` (percent); `organization`.
- **Registration:** `id`, `attributes` (registrant form data), `admin_attributes`,
  `registrant_email`, `server_pricing_results`, `client_reported_pricing`, `event`,
  `registration_type`, `payment_type`, `paypal_response`, `uuid`, timestamps.
- **Camper:** `id`, `attributes`, `admin_attributes`, `registration`, `lodging` (assigned),
  `lodging_requested`, `lodging_shared`/`lodging_shared_with`/`lodging_comments`,
  `server_pricing_results`, `sequence` (order within a registration), `stay` (array of ISO
  date strings the camper is present), timestamps.
- **RegistrationType:** `id`, `event`, `name` (machine), `label`, `invitation_email_subject`,
  `invitation_email_template`.
- **Invitation:** `id`, `registration?`, `registration_type?`, `invitation_code`,
  `recipient_name`, `recipient_email`, `sent_time?`, `expiration_time?`.
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
- **Validation:** uses custom error transformation (e.g. friendlier messages) and switches to
  live validation after the first failed submit. On error it surfaces the validation problems
  prominently and brings the first problem field into focus (phone-number fields need a focus
  workaround).
- **Pre-submit content:** before the registrant proceeds, optionally show an electronic-payment
  handling-charge notice (computed from `epayment_handling`) and the server-provided
  `preSubmitTemplate` (rendered through the template engine). An action advances the registrant
  to payment.
- **Submit:** posts `{ step: 'registration', formData, pricingResults, invitation? }`. On
  success it stores the returned payment-step payload and advances to the payment step.

### 7.2 Step 2 — Payment

Reads the payment-step payload's `serverPricingResults.total`:

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

- Renders `confirmationStep.confirmationPageTemplate` through the template engine, with
  template variables: `initialPayment`, `paymentInfo`, `registration`, `totals`
  (payment-step server pricing), and `pricing_results` (confirmation-step server pricing).
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
`lodging`, `reports`, `settings`; an unknown subpath falls back to `home`. (The routes are a
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
- Confirmation page template; confirmation email `from`/`subject`/`body`.
- PayPal: `paypal_enabled`, `paypal_client_id`, `epayment_handling`.
- `pricing` (a freely editable set of named integer values) and `registration_template_vars`
  (named string values).

Datetime fields use explicit timezone handling. (Exposing the underlying JSON is a useful
debugging aid.)

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
  email; this creates the invitation and sends it (`/invitations/{id}/send`).
- **Manage registration types** — create/edit a type's machine `name`, `label`, and invitation
  email subject/template.
- **Track invitations** — a sortable/filterable list of the event's invitations (default newest
  first) showing name, email, type, sent status, and linked registration (if redeemed), with
  per-row resend/delete. Status is derived: `redeemed` (has a registration), `unsent` (never
  sent), or `sent`. A redeemed invitation links through to its registration.

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

- **Editing a report** — its title; output format (`csv` Jinja→CSV, `md` Jinja→Markdown, `txt`
  Jinja→Text, `hbs` Handlebars→Markdown); the template body (edited in Monaco, language matching
  the format); and the `variables_schema` (JSON, validated). Title must be non-empty and the
  schema must parse — surface those errors. Deleting drops the `reportId` selection.
- **Viewing a report** — for `csv`/`md`/`txt`, the client POSTs to
  `/api/reports/{id}/render` with the full template-variable bundle and renders the returned
  string:
  - **CSV** → parsed (`d3-dsv`) and shown as a table with a row count; downloadable.
  - **Markdown** → run through the markdown→HTML pipeline; downloadable.
  - **Text** → shown as preformatted text; downloadable.
  - **Handlebars** (`hbs`) → rendered **client-side** through the template engine (Handlebars +
    markdown pipeline) using the same variable bundle.
  - Render errors are surfaced with the raw error text.

**Report template variables** (the bundle assembled client-side and passed to render/Template):
`event`, `registrations` (augmented) + `registrationLookup`, `campers` + `camperLookup`,
`lodgingLookup`, `registrationTypeLookup`.

### 8.8 Settings

An interface to edit the event's JSON configuration directly (in Monaco), each piece saving back
to the event via PATCH:

- Schemas: camper, registration, registration UI, deposit, payment.
- Pricing logic: camper pricing, registration pricing.
- Admin attribute schemas: registration admin attributes, camper admin attributes (each a map
  of named `{ data, ui }` pairs).

Registration types are managed with invitations (§8.4), not here (see §15, DR-11).

---

## 9. Shared Systems

### 9.1 JSON Schema Form engine

A wrapper around React JSON Schema Form (rjsf v6) with the `@rjsf/mantine` theme is the
backbone of both surfaces. The schema/uiSchema is the single source of truth. (Rationale and
the rjsf v4→v6 upgrade notes: §15, DR-4.) The wrapper must:

- Accept `schema`, `uiSchema`, `formData`, `onChange`, `onSubmit`, `onError`,
  `transformErrors`, and a custom `templateData` object exposed to descendants via React
  context (so description fields can render templated help text).
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
  leaf may be the final choice; tracks the chosen path.
- **Description** — renders schema/ui descriptions as templated markdown (via the Template
  engine and the form's `templateData`).

**Custom widgets:** Checkboxes, PhoneInput (international phone), NaturalNumberInput
(digits-only), Select (enum + disabled options), Text (optional prefix, integer sanitization,
datalist examples), Textarea (maxlength truncation).

**Custom templates:** Field (error list + templated description + help), Object (optional
content wrapper class), Array (custom title/description/add/remove labels).

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

Two-stage rendering used for descriptions, pre-submit/confirmation content, emails (server),
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
math (`sum`, `subtract`, `abs`), and `or`. An in-app **Template Help** reference documents the
available helpers and variables (with a downloadable view of the current variables) — useful
when authoring email/report templates.

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
- **Debug aids:** a debug logger gated to dev; raw JSON views on admin detail screens; in dev,
  the registration `onChange` is exposed on `window` for autofill, and a `KEEP_REG_DATA` flag
  preserves localStorage across confirmation.

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
  particular **Monaco** (load only when a report/schema editor opens), `mantine-react-table`,
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

- **Unit (Vitest):** thorough coverage of the **pricing engine** and template helpers, plus
  date/money utilities and other pure functions.
- **Pricing parity:** a shared fixture set (inputs → expected `PricingResults`) run against
  **both** `calculatePrice` (client) and `calculate_price` (server) in CI; any pricing change
  updates both sides (§15, DR-14).
- **Component (React Testing Library):** the form engine (custom fields/widgets/templates) and
  key admin screens.
- **E2E (Playwright):** one pass over registration → payment (PayPal sandbox / pay-by-check) →
  confirmation.
- **Gates:** type-check, lint, and tests pass in CI and in the pre-commit hook (§15, DR-15).

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
favors Mantine, and antd's Table advantage is matched by `mantine-react-table`/TanStack Table
without a kit switch (see DR-19).

### DR-4 — Forms: rjsf + `@rjsf/mantine`

**Decision:** Keep React JSON Schema Form, on the official `@rjsf/mantine` theme, **rjsf v6**
(the latest major) (§9.1).
**Context:** The form engine drives both surfaces and is the highest-leverage component.
`@rjsf/mantine` is an officially supported rjsf theme (an earlier assumption that no official
Mantine theme existed was incorrect), so the base widgets come for free. The substantive work
is therefore: (1) the rjsf **v4 → v6 upgrade** — form props/types move to `@rjsf/utils`,
validation is supplied via a separate validator (e.g. `@rjsf/validator-ajv8`), and the
`ObjectFieldTemplate`/`ArrayFieldTemplate`/`FieldTemplate` and widget/field registration APIs
changed; and (2) re-implementing the custom fields/widgets/templates (§9.1) on the new base.
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

### DR-19 — Admin data tables: mantine-react-table (TanStack Table)

**Decision:** Use `mantine-react-table` (built on TanStack Table + Mantine) for sortable,
filterable, paginated admin tables — the invitation report now, and the registrations and
campers lists as they convert from fuzzy-search card lists to tables (§8.2, §8.4, §8.5).
Sort/filter/pagination run **client-side** over the full per-event dataset (small at this scale —
DR-25), with table state held in TanStack Router search params.
**Context:** The admin is gaining real data-grid needs (sorting/filtering, and converting the
two largest lists to tables). This is a component-level need met *within* the chosen stack:
TanStack Table composes natively with TanStack Query (which fetches the per-event set) and
TanStack Router (table state as typed search params — the admin URL-as-state pattern, DR-2). It
does **not** justify switching UI kits — see DR-3.
**Alternatives:** Headless **TanStack Table** rendered with Mantine primitives (leaner, more
control, more wiring) — the lean fallback. **Ant Design Table** (turnkey, but would mean an antd
kit switch with the rjsf/public-surface costs in DR-3, rejected). `match-sorter` (DR-20) handles
lightweight client-side filtering on smaller lists.

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
**Context:** The current client uses Sass. Mantine v7 is built around CSS Modules + PostCSS;
adopting it keeps styling consistent with the component library, drops the Sass toolchain, and
provides Mantine's responsive/color-scheme mixins. Component-scoped styles avoid global leakage.
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
  bundle and the `step: 'registration' | 'payment'` posts (§5, §7).
- **Other endpoints:** `POST /api/reports/{id}/render` (§8.7), `POST /api/invitations/{id}/send`
  (§8.4), `GET /api/eventlist` (§4), `GET /api/customcharges/{camperId}` (§5).
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
the foundations everything else depends on.

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
   lodging (§8.6, the most custom — tree + assignment). Introduce `mantine-react-table` (DR-19)
   and `match-sorter` (DR-20) with the first list.
6. **Cross-cutting hardening.** Accessibility, responsive targets (DR-17), error boundaries,
   the Playwright e2e over registration→payment→confirmation, and bundle posture
   (lazy-load Monaco — admin/reports only).
7. **Deferred / future (not V1):** the plugin system (§14) and the items in §13 (deposits UI,
   invitation link, dual-pricing exploration) and `TODO.md`.
