# Releases

Camphoric is deployed by **version**. A release is a Git tag (`vX.Y.Z`) with a matching
**GitHub Release** that carries everything needed to deploy that exact version:

- **Source archives** — `Source code (zip/tar.gz)`, attached automatically by GitHub (the repo at
  the tag).
- **`frontend-build.tar.gz`** — the transpiled `client/` frontend (Vite build output).
- **`frontend-build-v2.tar.gz`** — the transpiled `client_v2/` frontend (the v2 rebuild; present on
  releases cut after it landed on `main`).
- **Container image** — `ghcr.io/camphoric/camphoric:<tag>`, the server with the v2 frontend baked
  in (`latest` also moves, for stable releases only). See [CONTAINER.md](./CONTAINER.md).

The deployment playbook is pointed at a tag and pulls the server code at that tag plus this
frontend asset, instead of tracking `main`.

Versions follow [Semantic Versioning](https://semver.org/) and the release automation is
[release-please](https://github.com/googleapis/release-please). The current version lives in
[`version.txt`](./version.txt).

---

## How a stable release is triggered

Releases are **PR-gated** — nothing is released just by pushing to `main`:

1. **Every push to `main`** runs the *Release Please* workflow. It does **not** cut a release; it
   opens or updates a single standing **release PR** (e.g. *"chore(main): release 0.2.0"*) that
   accumulates the next version bump (`version.txt`) and `CHANGELOG.md`
   entries from the [Conventional Commits](https://www.conventionalcommits.org/) merged since the
   last release. More merges just keep updating that same PR.
2. **Merge the release PR** when you're ready to ship. That creates the `vX.Y.Z` tag and the
   GitHub Release, and the *Release assets* build attaches `frontend-build.tar.gz`.

You never create tags by hand for stable releases — merging the release PR is the deliberate
"release now" action.

### Commit messages drive the version

Because the version bump is computed from commit messages, commits to `main` should use
Conventional Commit prefixes:

| Commit type                                  | Example                                   | Bump    |
| -------------------------------------------- | ----------------------------------------- | ------- |
| `fix:`                                       | `fix: correct fee rounding`               | patch   |
| `feat:`                                      | `feat: add camper export`                 | minor   |
| `feat!:` / `fix!:` / `BREAKING CHANGE:` foot | `feat!: drop legacy report format`        | major\* |
| `chore:` / `docs:` / `refactor:` / `test:`   | `docs: update README`                     | none    |

\* **Pre-1.0 caveat:** while `version.txt` is below `1.0.0`, release-please treats breaking
changes as a **minor** bump (e.g. `0.3.0`), not a major, per SemVer's "anything may change before
1.0.0" rule — this is enabled by `"bump-minor-pre-major": true` in `release-please-config.json`.
Once you're at `1.0.0`, breaking changes bump the major.

### Choosing an exact version (override the computed bump)

To cut a specific version regardless of the commits (for example, to graduate to `1.0.0`), add a
`Release-As:` footer to any commit on `main`:

```bash
git commit --allow-empty -m "chore: release 1.0.0" -m "Release-As: 1.0.0"
git push
```

release-please will set the pending release PR to exactly that version.

---

## Cutting a pre-release from a feature branch

Pre-releases (e.g. `v0.2.0-alpha.1`) are cut **manually from any branch** by pushing a
pre-release tag — no need to go through `main` or the release PR:

```bash
git checkout my-feature
git tag v0.2.0-alpha.1        # vX.Y.Z-<pre>.<n>  →  -alpha.N / -beta.N / -rc.N
git push origin v0.2.0-alpha.1
```

The *Pre-release* workflow creates a GitHub Release **flagged as a pre-release** (it is not shown
as "Latest"), and the *Release assets* build attaches `frontend-build.tar.gz` — the same asset as
a stable release. Deploy it exactly like a stable tag.

- Bump the trailing counter for the next iteration: `v0.2.0-alpha.2`, then `-beta.1`, `-rc.1`, etc.
- When the work lands on `main`, cut the **stable** `v0.2.0` through release-please as usual.
- Ordering note: a pre-release **precedes** its stable version — `v0.2.0-alpha.1` < `v0.2.0`.

---

## Deploying a release

Point the deployment playbook at the tag; it fetches the server code at that tag and downloads the
frontend asset(s) from the release. The assets always have the same filenames, so their URLs vary
only by tag:

```
https://github.com/camphoric/camphoric/releases/download/<tag>/frontend-build.tar.gz
https://github.com/camphoric/camphoric/releases/download/<tag>/frontend-build-v2.tar.gz
```

Alternatively run the container image for that tag — `ghcr.io/camphoric/camphoric:<tag>` — see
[CONTAINER.md](./CONTAINER.md).

```bash
# stable
--extra-vars '{"camphoric_release": "v0.2.0",         "camphoric_force_update": true}'
# pre-release
--extra-vars '{"camphoric_release": "v0.2.0-alpha.1", "camphoric_force_update": true}'
```

Leaving `camphoric_release` at its default (`HEAD`) still deploys the tip of `main` as before.

### Host requirements

The server runs on Django 6.1 with **Python 3.12+** and **PostgreSQL 16+** (the version it's
tested against; Django 6.1 itself needs 15 or newer). Ubuntu 22.04's
packages (Python 3.10, PostgreSQL 14) are too old, so upgrade the host before deploying a release
that includes the upgrade. On Ubuntu 24.04 (Python 3.12, PostgreSQL 16), which the Ansible role
targets:

1. Back up the database: `pg_dump camphoric > camphoric.sql`.
2. Move the host to 24.04: a fresh host, or `do-release-upgrade` followed by a PostgreSQL cluster
   upgrade.
3. On a fresh host, restore the dump: `psql camphoric < camphoric.sql`.
4. Deploy the release, which runs the migrations.

The container image already meets the Python requirement; its `DATABASE_URL` must point at
PostgreSQL 16 or newer.

---

## Event-import packages

The event-import packages in `data/packages/` are published to GitHub Packages (see "Event import
packages" in the [README](./README.md)) and released on their own versions, as release-please
components alongside the app:

| Package | Folder | Tag |
| --- | --- | --- |
| `@camphoric/camphoric-event-import-spec` | `data/packages/event-import-spec` | `camphoric-event-import-spec-vX.Y.Z` |
| `@camphoric/camphoric-event-import-tools` | `data/packages/import-tools` | `camphoric-event-import-tools-vX.Y.Z` |

- **Separate release PRs.** Each package gets its own release PR (and `CHANGELOG.md` in its
  folder), from the Conventional Commits touching its folder. Merging it tags the release and
  publishes that version (`release-packages.yml`), so a package can be released without releasing
  the app, and the other way round.
- **The app ignores package-only changes.** A commit that only touches `data/packages/` doesn't
  bump the app's version (`exclude-paths` in `release-please-config.json`); one that also touches
  anything else does. The app's tags stay `vX.Y.Z`.
- **Independent versions.** Neither package depends on the other once installed (the tools keep
  their own copies of the two spec types they use, and a test keeps those identical), so their
  release PRs can be merged in any order. In this repository, the importer, the events and the
  tools use each other's workspace copies (`"*"`), whatever version a release gives them.
- **Publishing access.** The repository that publishes a package must keep the **Write** (or
  Admin) role in the package's settings, under "Manage Actions access"; with only Read, the publish
  job fails with `403 … write_package`. Other repositories need no grant to install a public
  package.
- **Republishing.** To publish a released tag again (if the publish job failed), run
  `gh workflow run release-packages.yml -f tag=camphoric-event-import-spec-v1.0.0`; a version
  that's already published is skipped, and one older than the newest published version doesn't
  move the `latest` dist-tag.

### What a spec version means

`@camphoric/camphoric-event-import-spec` is the contract between Camphoric and every camp's event
module, so its versions follow what an event module has to do:

- **patch / minor** — no event module needs to change (a fix, or a new optional field).
- **major** (`feat(data)!:`) — event modules must change to follow it (a field removed or now
  required, a type narrowed).

Every event package takes the spec as a **peer dependency** (`"^1.0.0"`), so the importer loads
one copy of the spec and checks each event against it. An event installed from an event
repository (#780) whose range the spec in this repository doesn't satisfy is refused by `npm
install` and fails the tests, never a second, nested copy. In this repository the events also take the
workspace copy as a devDependency (`"*"`); an event repository's devDependency is its peer range.

A breaking change to the spec keeps `main` holding a spec, an importer and events that work
together:

1. **Each event repository releases a version that meets both majors**, with the peer range
   `"^1.0.0 || ^2.0.0"`. So land a breaking change in two steps an event can follow: first, in a
   minor, add what replaces the old form (a new field, optional); then, in the major, remove or
   require it.
2. **One PR here** changes the spec, the importer and the events in `data/events/` (widening their
   peer range the same way), and raises the importer's ranges for the event repositories' packages
   to those releases. This repository's tests then check every event against the new spec.
3. **Merge the spec's release PR**, which publishes the new major. Until it bumps the spec's
   version, the tests check peer ranges against the old major, so an event that skipped step 1
   first fails this PR's checks.
4. Each event repository then takes the new major as its devDependency and may narrow its peer
   range to it.

### Spec versions each Camphoric release supports

A Camphoric release imports events written against the major of the spec in its tree
(`data/packages/event-import-spec/package.json` at the release's tag); that file is the
authoritative record. A new row is added with each spec major:

| Camphoric release | Event import spec |
| --- | --- |
| the first release containing the published packages, and later | `1.x` |

---

## Workflows involved

| Workflow                              | Trigger                        | Does |
| ------------------------------------- | ------------------------------ | ---- |
| `.github/workflows/release-please.yml`| push to `main`                 | maintains the release PRs (the app's and each package's); on merge, tags + creates the GitHub Release, then builds assets (app) or publishes (packages) |
| `.github/workflows/prerelease.yml`    | push a `vX.Y.Z-*` tag          | creates the pre-release, then builds assets |
| `.github/workflows/release-assets.yml`| called by the two above        | builds `client/` and `client_v2/` and attaches `frontend-build.tar.gz` + `frontend-build-v2.tar.gz` to the tag |
| `.github/workflows/release-image.yml` | called by the two above        | builds the image at the tag and pushes `ghcr.io/camphoric/camphoric:<tag>` (+ `latest` for stable releases) |
| `.github/workflows/release-packages.yml` | called by `release-please.yml` when a package release PR merges, or run by hand with a tag | builds the event-import package at its tag and publishes it to GitHub Packages |
| `.github/workflows/data.yml`          | push/PR to `main` touching `data/` | type-checks and tests the importer and the event packages, and smoke-tests the packed packages |
| `.github/workflows/docker.yml`        | push/PR to `main` touching `server/`, `client_v2/`, `data/` or the Docker files | builds the image (never pushed), smoke-tests it against Postgres and imports every event into it, and runs Sample Camp's registration-form e2e tests against a throwaway server from it |
| `.github/workflows/client-v2.yml`     | push/PR to `main` touching `client_v2/` | type-checks, lints and unit-tests the v2 client, and runs its Playwright e2e suite |
| `.github/workflows/react.yml`         | push/PR to `main` touching `client/` | unchanged — the continuous `js-build-main` dev build |

> The asset build is invoked directly by the two release workflows (not by a `release: published`
> trigger) because a release created with the default `GITHUB_TOKEN` does not start other
> workflows.
