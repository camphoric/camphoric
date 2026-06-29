# General Coding Guidelines

Code should always be as human-readable as possible (i.e. "Clean Code"). Optimize for the next
person to read the code, not for the cleverest way to write it. Some guiding principles follow.

## Give variables clear and concise names

If a variable name can be a little bit longer to help readability, then lean on that. Likewise,
utility functions should be named after the function that they perform.

- Prefer descriptive names over abbreviations (`registrationTotal`, not `regTot`).
- Booleans read as predicates: `isOpen`, `hasInvitation`, `canAddCamper`.
- Functions are verbs or verb phrases; the name should describe the effect
  (`calculatePrice`, `formatDateForApi`, `getCamperDisplayId`).
- React components and their files are `PascalCase`; hooks start with `use`; non-component
  modules/utilities are `camelCase`.
- Event handlers are named for what they do, not the event (`submitRegistration`, not
  `onClick2`). Handler props are `onSomething`; their implementations are `handleSomething`.
- Avoid single-letter names except for tight, conventional scopes (a map index, a coordinate).
- Don't encode types into names (no Hungarian notation) — the type system already does that.

## Don't repeat yourself

If at all possible, abstract repeated code into utility functions, classes, or reusable
components. When designing UI components, especially if a component is logic-heavy, separate
components into separate files, inside their own directory.

- Reach for an abstraction on the **third** occurrence, not the first. Two similar-looking
  pieces of code that change for *different reasons* are not duplication — don't force them
  together (avoid the wrong abstraction, which is more expensive than a little repetition).
- Put shared logic where it belongs: cross-cutting helpers in `utils/`, data-fetching and
  derived data in hooks, and pure domain calculations in their own modules.
- Prefer composition over inheritance and over deeply parameterized "do-everything" helpers.

## Keep components small and focused

- Separate **logic-heavy** components from presentation. A common pattern in this codebase is a
  container component that fetches/derives data and a presentational component that renders it
  (e.g. `EventAdminHome` → `EventAdminHomeComponent`). Follow that pattern for non-trivial
  screens.
- Give each component a single responsibility. If a component is doing two things, split it.
- Co-locate a component, its subcomponents, styles, and tests in a directory with an
  `index.ts(x)` barrel that re-exports the public surface.
- Lift state only as high as it needs to go; keep transient UI state local.

## TypeScript

- **Avoid `any`.** Prefer the shared API types (declared globally in
  `client/src/global.d.ts`, e.g. `ApiEvent`, `ApiRegistration`, `ApiCamper`) and derive
  narrower types with utility types where useful.
- Don't reach for `@ts-ignore` / `@ts-expect-error` to silence the compiler. If one is truly
  necessary (e.g. a third-party typing gap), leave a short comment explaining why.
- Type function boundaries (params and return types) explicitly; let inference handle locals.
- Prefer discriminated unions and exhaustive `switch` handling over loose optional flags.
- Keep the API types in sync with the backend serializers — they are a hand-maintained
  contract (see *API and the client/server contract*).

## Comments

- Comment the **why**, not the **what**. Code says what it does; comments explain intent,
  trade-offs, and non-obvious constraints.
- Call out load-bearing subtleties explicitly (e.g. "must match `server/camphoric/pricing.py`",
  "API requires a trailing slash", "PayPal drops the deposit choice, so we embed it in
  `custom_id`"). These are the comments that save the next person hours.
- Delete commented-out code rather than committing it; git is the history.

## Error handling

- Don't silently swallow errors. Surface them to the user (inline message / notification) and
  log enough context to debug.
- Wrap risky subtrees (dynamic forms, template rendering, payment) in error boundaries so one
  failure doesn't take down the page.
- Validate at boundaries (form input, API responses) rather than trusting shapes deep in the
  code.

## Formatting and linting

- Match the surrounding code's style (indentation, import ordering, comment density). Don't
  reformat unrelated lines in a change — it pollutes diffs and reviews.
- Keep the linter and type-checker clean; the dev build runs both (`vite-plugin-checker` +
  ESLint). Fix warnings rather than suppressing them.
- Prefer small, focused modules over large files.

---

# Frontend-Specific Guidance (`client/`)

See [`SPEC_CLIENT_V2.md`](./SPEC_CLIENT_V2.md) for the full picture. Key working rules:

> **Note:** `SPEC_CLIENT_V2.md` describes the **planned V2 rebuild**, not the current `client/`
> codebase (which still uses Redux Toolkit / RTK Query, React-Bootstrap, etc.). When working on
> the **existing** client, follow its established patterns; the architecture guidance below is
> the V2 direction and applies to the rebuild and to new code written against it. Once the
> rebuild ships and the spec becomes the current spec, this note goes away.

## Architecture

- The app is **data-driven**: most form structure, pricing, templates, and admin attributes
  come from server-configured JSON Schema / JSON Logic / templates. Render whatever the event
  defines — avoid hard-coding event-specific behavior in the client.
- Separate **server state** from **client state**. Server data belongs in the data-fetching
  layer (cache + invalidation); genuine client state (the in-progress registration) is the only
  thing that needs a client store. Don't copy fetched data into component state "to be safe."
- Use the path aliases (`components`, `hooks`, `navigation`, `pages`, `store`, `utils`) instead
  of long relative imports.

## Pricing parity (critical)

The client computes pricing live for UX, but **the server is authoritative**. The client's
`calculatePrice` must produce results identical to the server's `calculate_price`
(`server/camphoric/pricing.py`). If you change one, change and verify the other, and always
adopt the server's returned `serverPricingResults` after submission. Diverging means the
registrant sees a different total than they are charged.

## Security

- All HTML rendered from user/template content **must** be sanitized (the markdown pipeline
  uses `rehype-sanitize`). Never feed unsanitized content to `dangerouslySetInnerHTML`.
- Mutating requests must include the CSRF token; requests send credentials. Don't bypass the
  established fetch/CSRF setup.
- Never log or expose secrets (PayPal/Google keys come from configuration, not source).

## Conventions

- **Money** is handled in whole dollars and formatted to two decimals (`moneyFmt`).
- **Dates** use the shared time utilities; be deliberate about UTC vs. local to avoid
  off-by-one day errors. Form dates are `YYYY-MM-DD`.
- Admin selection state lives in **URL query params** (`?registrationId`, `?camperId`, …) so
  views are shareable and back/forward-friendly — keep it there rather than in local state.
- Show a loading indicator until required data resolves; render detail panes only once a
  selection exists.

---

# Backend Guidance (`server/`)

Django 4.0 + Django REST Framework, Python 3.12. The Django project package is
`camphoric_server/`; the main app is `camphoric/`; a small `frontend_bootstrap/` app serves the
built client. Match the patterns already in the codebase rather than introducing new ones.

## Project layout and configuration

- **Dependencies** are managed with **Pipenv** (`server/Pipfile`/`Pipfile.lock`). Add deps
  there, not with a bare `pip install`.
- **Settings are split:** `camphoric_server/settings_default.py` (environment-agnostic
  defaults) → `settings.py` (base overrides) → optional `settings_override.py` for local dev.
  Configuration comes from the environment via **`django-environ`** (`env = environ.Env()`,
  e.g. `DATABASE_URL`, `SECRET_KEY`, `PAYPAL_*`, email settings). Never hard-code secrets or
  environment-specific values; read them through `env`.

## Models (`camphoric/models.py`)

- **Inherit `TimeStampedModel`** for domain models. It provides `created_at` / `updated_at` and
  a soft-delete `deleted_at` with `soft_delete()` / `soft_undelete()`.
- **Soft delete is not globally enforced** — there is no manager that hides soft-deleted rows.
  When you query, filter explicitly with `.filter(deleted_at__isnull=True)` where appropriate.
- Use **`CustomJSONField`** (wraps `JSONField` with `DjangoJSONEncoder`) for JSON columns —
  schemas, `attributes`, `admin_attributes`, pricing logic, etc.
- Use **`models.TextChoices`** for enumerations (see `PaymentType`, `ReportOutputType`).
- **Validate JSON against its schema** using the helpers (`validate_schema` checks a schema is
  valid Draft-7; `validate_attributes` validates instance data against the event's schema).
- **Saving recalculates pricing.** `Camper.save()` / `CustomCharge` save+delete trigger
  `Registration.recalculate_server_pricing()` → `pricing.calculate_price()`. This is
  intentional (server pricing is the audit source of truth). For bulk operations where you must
  avoid the cascade, use `Camper.save_without_recalc()` — but understand why before doing so.

## Serializers (`camphoric/serializers.py`)

- Plain DRF `ModelSerializer`s, typically `fields = '__all__'`; there is no shared base class.
- Put schema/shape validation in `validate_<field>` / `validate` methods (and reuse the
  `validate_schema` / `validate_attributes` helpers). Partial updates intentionally skip some
  validation when the parent (`event`/`registration`) isn't in the payload — follow that
  pattern.
- Sensitive fields are `write_only` / excluded (e.g. user password, email-account password).

## Views, routing, and the API contract

- CRUD resources are **`ModelViewSet`s** registered on a DRF **`DefaultRouter`** in
  `camphoric/urls.py`. The router enforces **trailing slashes** (`/api/registrations/`). Custom
  non-CRUD endpoints are plain `APIView`s added to `urlpatterns` (these have **no** trailing
  slash — e.g. `/api/login`, `/api/user`, `/api/events/<id>/register`, `/api/reports/<id>/render`,
  `/api/invitations/<id>/send`, `/api/set-csrf-cookie`).
- **Filtering** uses `django-filter`'s `DjangoFilterBackend`; declare `filterset_fields` on the
  viewset (e.g. `Registration` filters on `['event', 'completed']`). The client relies on these
  query params — keep them stable.
- **Permissions:** viewsets default to `IsAdminUser`. Public endpoints (registration, event
  list, CSRF cookie) are deliberately open. Don't loosen a viewset's permissions casually.
- **Auth:** session auth + CSRF is what the client uses; login is `csrf_protect`-ed and sets an
  httponly session cookie.
- **The REST API is a contract with the client.** Changing field names, types, URL shapes
  (including trailing slashes), filter params, or status codes can break the frontend.
  Coordinate such changes and update the client's `global.d.ts` types in the same change.
- **Naming convention:** standard CRUD serializers expose **snake_case** model fields
  (`paypal_enabled`, `registration_start`). The bespoke registration/payment/report endpoints
  build their own response shapes and use **camelCase** there (`dataSchema`, `preSubmitTemplate`,
  `serverPricingResults`). Match whichever convention the surrounding endpoint already uses.

## Business logic organization

Keep non-trivial logic in dedicated modules, not in fat views or models:

- `pricing.py` — `calculate_price()` (JsonLogic via `json-logic-qubit`); **authoritative**, and
  the client's `calculatePrice` must mirror it (see *Pricing parity* in the frontend section).
- `lodging.py` — lodging-tree schema generation, capacity/sharing math.
- `mail.py` — per-event email backends (`EmailAccount`), bulk-email send/cancel with rate
  limiting and resumability.
- `paypal.py` — PayPal client + order verification.
- `json_logic_template.py` — variable injection into JsonLogic expressions.
- **Templating:** Handlebars via `chevron` (confirmation/invitation/bulk-email templates),
  Jinja2 for reports, and `cmarkgfm` for Markdown→HTML. Reuse the configured `jinja_env`
  (with its `money_fmt` / `regex_replace` filters) rather than building a new environment.

## Testing (`server/tests/`)

- Tests are **centralized** in `server/tests/` (not per-app), named `test_<area>.py`, using
  Django's `TestCase` / DRF's `APITestCase` (no pytest, no factory_boy). Create fixtures with
  the ORM directly in `setUp()`.
- Use **`freezegun`**'s `@freeze_time(...)` for any time-dependent behavior (timestamps,
  registration windows, pricing dates).
- Mock external HTTP (PayPal) with the existing `MockServer` helper; assert on emails via
  `django.core.mail.outbox`.
- Run with `python manage.py test`. **Cover pricing, lodging, and any schema/validation logic**
  — these are the high-risk areas — and add a failing-then-passing test when fixing a bug.

## Migrations and tooling

- Any model change needs a migration (`manage.py makemigrations`); keep them reviewable and
  reversible. Migrations live in `camphoric/migrations/`.
- **Linting is flake8 only** (`server/setup.cfg`: `max_line_length = 100`, migrations excluded).
  There is no black/isort/ruff/mypy and no pre-commit or CI wired up — so **run `flake8` before
  pushing** and keep imports/formatting tidy by hand. (Introducing an autoformatter/CI is a
  reasonable improvement, but propose it rather than reformatting the tree in an unrelated PR.)

---

# API and the client/server contract

If working on frontend features, **avoid changing the API**. You may suggest API changes, but
do not change the API or backend code unless explicitly given permission to do so.

When an API change *is* authorized:

- Update the backend serializer/view and the client's `global.d.ts` types in the same change so
  the contract stays consistent.
- Preserve backward compatibility where the client depends on existing shapes, or update the
  client in lockstep.
- Add or update tests on both sides.

---

# Testing

- Frontend tests run with Vitest (`npm test` in `client/`). Co-locate tests as `*.test.ts(x)`.
- Prioritize tests for the highest-risk, highest-leverage logic: the **pricing engine**,
  template helpers, date/money utilities, and other pure functions.
- Test behavior and public interfaces, not implementation details. Avoid brittle snapshot tests
  of large, frequently-changing components.
- When fixing a bug, add a test that fails before the fix and passes after.

---

# Git and Pull Requests

- Make small, focused commits with clear, present-tense messages describing intent.
- Keep a change set scoped to one concern; spin unrelated cleanups into their own commits/PRs.
- Don't commit commented-out code, debug logging, secrets, or generated artifacts.
- Ensure the type-checker, linter, and tests pass before opening a PR.

---

# Working Style for Assistants

- Respect the API-editing rule above: frontend tasks should not modify backend/API code without
  explicit permission.
- When you spot a worthwhile but out-of-scope change, note it rather than expanding the current
  task.
- Prefer the smallest change that correctly solves the problem, and match existing patterns and
  naming in the file you're editing.
- Surface trade-offs and ask before making hard-to-reverse or contract-changing decisions.

