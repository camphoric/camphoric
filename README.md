# Camphoric

Camphoric is a camp registration and administration system. It has two parts:

- **`server/`** — a Django + Django REST Framework backend (the source of truth for data, pricing,
  persistence, and email).
- **`client/`** — a React + TypeScript single-page app with two surfaces: a public **registration**
  flow and an authenticated **admin** back-office. (`client_v2/` is an in-progress rebuild.)

## Documentation

- **[RELEASE.md](./RELEASE.md)** — how versioned releases are cut and deployed.
- **[SPEC_CLIENT_V2.md](./SPEC_CLIENT_V2.md)** — behavior and architecture of the client rebuild.
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — coding standards and contribution guidelines.
- **[doc/](./doc)** — development and operational notes.

## Releases

Deploys are pinned to a **version** (`vX.Y.Z`). Each release is a GitHub Release carrying the repo
source plus the built frontends (`frontend-build.tar.gz` and `frontend-build-v2.tar.gz`), cut with
[release-please](https://github.com/googleapis/release-please) from
[Conventional Commits](https://www.conventionalcommits.org/). See **[RELEASE.md](./RELEASE.md)**.
