# Camphoric

Camphoric is a camp registration and administration system. It has two parts:

- **`server/`** — a Django + Django REST Framework backend (the source of truth for data, pricing,
  persistence, and email).
- **`client/`** — a React + TypeScript single-page app with two surfaces: a public
  **registration** flow and an authenticated **admin** back-office.

## Documentation

- **[RELEASE.md](./RELEASE.md)** — how versioned releases are cut and deployed.
- **[CONTAINER.md](./CONTAINER.md)** — the container image: environment variables, mount points,
  and how to run it.
- **[SPEC_CLIENT_V2.md](./SPEC_CLIENT_V2.md)** — behavior and architecture of the client.
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — coding standards and contribution guidelines.
- **[doc/](./doc)** — development and operational notes, including
  **[doc/payments.md](./doc/payments.md)**: how payments, invoices, refunds and PayPal work, with
  diagrams, and **[doc/event-repo-ci.md](./doc/event-repo-ci.md)**: how the camps' event
  repositories get tested against new Camphoric releases.

## Releases

Releases are versioned (`vX.Y.Z`). Each release is a GitHub Release carrying the repo source plus
the built frontend (`frontend-build-v2.tar.gz`), cut with
[release-please](https://github.com/googleapis/release-please) from
[Conventional Commits](https://www.conventionalcommits.org/). See **[RELEASE.md](./RELEASE.md)**.
Each release also publishes a container image to `ghcr.io/camphoric/camphoric`, a deploy pinned
to a **version** — see **[CONTAINER.md](./CONTAINER.md)**. The Ansible playbook in this
repository provisions the development VM from the code checked out there; it doesn't deploy a
release (see "Deploying a release" in RELEASE.md).

## Event import packages (npm)

The contract a camp's event definition satisfies, and the tools around it, are public packages
on [npm](https://www.npmjs.com/org/camphoric), released on their own versions (see
[RELEASE.md](./RELEASE.md)):

- **`@camphoric/camphoric-event-import-spec`** — the event import object's schema and types,
  `validateEventImport()`, the module contract, the conformance tests every event runs, and the
  shared `tsconfig.base.json`. A major version is a change event modules must follow.
- **`@camphoric/camphoric-event-import-tools`** — the Camphoric REST client, login, the event
  importer (`CamphoricEventCreator` and the organization loader, given the spec's
  `validateEventImport`), Playwright scaffolding for an event's registration-form e2e tests, and
  the bulk-registration runner. It depends on no spec version.

Their source is in [`data/packages/`](./data/packages). Within this repository the importer and
Sample Camp (`data/events/sample-camp`, a made-up event for the tests) use them as npm workspaces
(from source). Each camp's event is developed in a repository of its own,
`camphoric/camphoric-event-<name>`, and published from there to npm as
`@camphoric/camphoric-event-<name>` (see "Event repositories" in [RELEASE.md](./RELEASE.md)).
Installing any of them needs no token. Each is published with
[provenance](https://docs.npmjs.com/generating-provenance-statements), linking a version to the
workflow run that built it.
