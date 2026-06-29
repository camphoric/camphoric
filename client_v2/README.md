# Camphoric Client (V2)

A ground-up rebuild of the Camphoric web client per
[`SPEC_CLIENT_V2.md`](../SPEC_CLIENT_V2.md). It is built as a sibling of the existing `client/`
and is intended to **replace `client/`** once it ships.

Two surfaces share one foundation:

- **Registration** — a public, mobile-first multi-step signup + payment flow.
- **Admin** — an authenticated back-office for organizers.

## Stack

React + TypeScript on **Vite**; **Mantine** (CSS Modules + PostCSS) for UI; **TanStack Query**
for server state and **TanStack Router** for typed routes/search params; **Zustand** for the only
genuine client state (the in-progress registration); **Luxon** for dates. See the spec's Decision
Records (§15) for the rationale behind each choice.

## Status — Phase 1 (scaffold + foundations)

This is the foundation pass: a runnable shell with the build tooling, app bootstrap, routing
skeleton, auth guard, data-layer primitives, and shared UI shells. **Feature screens render
placeholders** and land in later phases (form + pricing + templating engines → registration flow
→ admin sections). See [`../SPEC_CLIENT_V2.md`](../SPEC_CLIENT_V2.md) Appendix B for the build order.

What works now:

- CSRF → user bootstrap gate before the router mounts (§3).
- Public/admin route split with an auth guard + login, typed admin search params, and trailing-
  slash normalization (§4, §6).
- `createEntityHooks` factory over TanStack Query with multi-key invalidation, and the Zustand
  registration store shell (§5).
- Session lifecycle: login/logout, proactive whoami keep-alive (§6, DR-26).
- Shared error boundary, loading indicators, and JSON viewer (§9.6).

## Develop

```sh
npm install
npm run dev        # Vite dev server on :3000, proxies /api to the backend
```

The dev server proxies `/api` to the Django backend. Set the target with `VITE_API_PROXY`
(defaults to `http://localhost:8000/`). Copy `.env.example` to `.env` to configure it and the
optional Google Maps key. Run the backend separately (see the repo's VM/dev setup docs).

## Quality gates

```sh
npm run build      # tsc -b + vite build (outputs to build/)
npm run lint       # ESLint (flat config, type-checked)
npm test           # Vitest
npm run format     # Prettier
```

`vite-plugin-checker` surfaces type and lint errors in the dev server.

## Path aliases

Import via `components`, `hooks`, `navigation`, `pages`, `store`, `utils`, `pricing`, and
`api-types` (declared in both `vite.config.ts` and `tsconfig.app.json`) rather than long relative
paths. The form engine and templating engine live under `components/` (`components/form`,
`components/templating`); `pricing` is a standalone module since it's pure domain logic with no
components.

> Pre-commit hooks: `lint-staged` is configured but `husky` is not auto-initialized because the
> git root is the repository root, not this folder. Wire it up alongside CI in a later pass.
