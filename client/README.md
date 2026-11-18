# Camphoric Client

The Camphoric web client, built per [`SPEC_CLIENT_V2.md`](../SPEC_CLIENT_V2.md). It is a
ground-up rebuild of the v1 client, which it has replaced (it lived in `client_v2/` until then).

Two surfaces share one foundation:

- **Registration** — a public, mobile-first multi-step signup + payment flow.
- **Admin** — an authenticated back-office for organizers.

## Stack

React + TypeScript on **Vite**; **Mantine** (CSS Modules + PostCSS) for UI; **TanStack Query**
for server state and **TanStack Router** for typed routes/search params; **Zustand** for the only
genuine client state (the in-progress registration); **Luxon** for dates. See the spec's Decision
Records (§15) for the rationale behind each choice.

## Develop

```sh
npm install
npm run dev        # Vite dev server on :3000, proxies /api to the backend
```

The dev server proxies `/api` to the Django backend. Set the target with `VITE_API_PROXY`
(defaults to `http://localhost:8000/`), in your shell or in `.env`; the shell's wins. Copy
`.env.example` to `.env` to configure it and the optional Google Maps key. Run the backend
separately (see the repo's VM/dev setup docs).

## Quality gates

```sh
npm run build      # tsc -b + vite build (outputs to build/)
npm run lint       # ESLint (flat config, type-checked)
npm test           # Vitest
npm run format     # Prettier
```

`vite-plugin-checker` surfaces type and lint errors in the dev server.

## End-to-end tests

```sh
npm run e2e        # Playwright: the component suite on Storybook, the registration smoke on the app
```

The run builds and serves its own Storybook (port 61000) and dev server (3003, proxying `/api`
to `VITE_API_PROXY`) on 127.0.0.1, and stops them when it ends. To run two at once, from two
worktrees say, give one other ports with `CAMPHORIC_E2E_STORYBOOK_PORT` and
`CAMPHORIC_E2E_APP_PORT`. A run waits for its own servers to say they're listening, so if a port
is taken on 127.0.0.1 (by another run, even one that took it during this one's Storybook build,
or by a Docker or Vagrant port) the run fails, rather than testing what answers there, which
could be another worktree's code. To use a server you started yourself on one of
those ports instead, set `CAMPHORIC_E2E_REUSE_SERVERS=1`. The registration smoke skips when no
backend answers.

## Path aliases

Import via `components`, `hooks`, `navigation`, `pages`, `store`, `utils`, `pricing`, and
`api-types` (declared in both `vite.config.ts` and `tsconfig.app.json`) rather than long relative
paths. The form engine and templating engine live under `components/` (`components/form`,
`components/templating`); `pricing` is a standalone module since it's pure domain logic with no
components.

> Pre-commit hooks: `lint-staged` is configured but `husky` is not auto-initialized because the
> git root is the repository root, not this folder. Wire it up alongside CI in a later pass.
