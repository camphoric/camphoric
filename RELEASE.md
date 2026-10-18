# Releases

Camphoric is deployed by **version**. A release is a Git tag (`vX.Y.Z`) with a matching
**GitHub Release** that carries everything needed to deploy that exact version:

- **Source archives** — `Source code (zip/tar.gz)`, attached automatically by GitHub (the repo at
  the tag).
- **`frontend-build-v2.tar.gz`** — the transpiled `client/` frontend (Vite build output).
  Releases cut before the v1 client was retired also carry `frontend-build.tar.gz`, the v1 build.
- **Container image** — `ghcr.io/camphoric/camphoric:<tag>`, the server with the v2 frontend baked
  in (`latest` also moves, for stable releases only). See [CONTAINER.md](./CONTAINER.md).

The container image is the versioned deploy. The Ansible playbook builds the frontend from the
checkout it deploys (see *Deploying a release*).

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
   GitHub Release, and the *Release assets* build attaches `frontend-build-v2.tar.gz`.

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
as "Latest"), and the *Release assets* build attaches `frontend-build-v2.tar.gz` — the same asset as
a stable release. Deploy it exactly like a stable tag.

- Bump the trailing counter for the next iteration: `v0.2.0-alpha.2`, then `-beta.1`, `-rc.1`, etc.
- When the work lands on `main`, cut the **stable** `v0.2.0` through release-please as usual.
- Ordering note: a pre-release **precedes** its stable version — `v0.2.0-alpha.1` < `v0.2.0`.

---

## Deploying a release

Run the container image for that tag — `ghcr.io/camphoric/camphoric:<tag>` — see
[CONTAINER.md](./CONTAINER.md).

The frontend asset has the same filename on every release, so its URL varies only by tag:

```
https://github.com/camphoric/camphoric/releases/download/<tag>/frontend-build-v2.tar.gz
```

The Ansible playbook deploys the code already checked out on the host: it builds `client/`
there (`npm ci && npm run build`) and installs the build into
`server/frontend_bootstrap/build/`, so the frontend always matches the server code beside it. It
then collects Django's static files (which Django serves, with `DEBUG` off, only from
`STATIC_ROOT`) and restarts the `camphoric` service, so the new code and build take effect. The
role does not yet check out `camphoric_release`
([#797](https://github.com/camphoric/camphoric/issues/797)), so check out the tag on the host before
running it. Set `camphoric_environment` to `production` and override the role's placeholder
secrets in the inventory or a vault-encrypted `host_vars` file: outside development the camphoric
role fails at its first task while one is left at its default (see
[the role's README](./ansible/roles/camphoric/README.md#secrets)).

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

## Event repositories

Each camp's event is a package of its own, developed and released in its own public repository and
published to GitHub Packages, which Camphoric's importer (`data/`) installs (#780). Sample Camp, a
made-up event for this repository's tests, is the only event still in `data/events/`.

| Event | Repository | Package |
| --- | --- | --- |
| Lark Camp | [camphoric/camphoric-event-lark](https://github.com/camphoric/camphoric-event-lark) | `@camphoric/camphoric-event-lark` |
| Jughandle Campout | [camphoric/camphoric-event-ltacampout](https://github.com/camphoric/camphoric-event-ltacampout) | `@camphoric/camphoric-event-ltacampout` |
| Family Week | [camphoric/camphoric-event-familyweek](https://github.com/camphoric/camphoric-event-familyweek) | `@camphoric/camphoric-event-familyweek` |
| Camp Harmony | [camphoric/camphoric-event-harmony](https://github.com/camphoric/camphoric-event-harmony) | `@camphoric/camphoric-event-harmony` |

- **Releases.** Each repository releases with release-please from its Conventional Commits (tags
  `vX.Y.Z`; `feat:` and `fix:` release, `feat!:` is a major), and merging its release PR publishes
  that version. Its CI type-checks, runs the spec's conformance tests, lints and smoke-tests the
  packed package; its e2e tests drive the registration form against the latest Camphoric image, on
  pull requests and weekly. The Actions bot opens the release PR, so its CI and e2e runs wait for
  someone to approve them.
- **Publishing access.** As for the packages above, each repository keeps the Write (or Admin)
  role in its package's "Manage Actions access".
- **In Camphoric.** The importer installs each event by a caret range, and the lockfile pins the
  version every workflow tests; a new minor or patch reaches it with a lockfile update. Every week,
  `events-latest.yml` tests the newest versions the ranges allow, and opens an `event-compat` issue
  when one fails, when an event publishes a major beyond its range, or when the org has an event
  repository whose package `data/` doesn't install. A new event major needs the importer's range
  raised; a new spec major is rolled out as described in "What a spec version means" above.

### Adding a camp's event

1. **Start the repository from the event repository most like the new event** (the Jughandle
   Campout's has report files, a bulk script and `packagePath.ts`; Family Week's has none of them):
   copy its configs, `.github/workflows/`, `scripts/`, `e2e/` setup, `__tests__/conformance.test.ts`
   (with the new package's name), `README.md`, `LICENSE`, `.npmrc` and `.gitignore`, but not its
   `CHANGELOG.md`, and put the new event's source in place of its event files. Sample Camp
   (`data/events/sample-camp`) shows every part of the import contract; don't bring its
   `coverage.test.ts` or `dates.test.ts`, which only fit Sample Camp. Then reset what the copy's own
   releases set:
   - `package.json`: the name (`@camphoric/camphoric-event-<name>`), description and repository,
     version `0.0.0`, the `dependencies` the event's source imports, and `files` with `reports`
     only if it has report templates;
   - `.release-please-manifest.json`: `{}`;
   - `release-please-config.json`: drop `bootstrap-sha`, which only skipped history brought over
     from this repository.
2. **Write its first e2e tests** of the camp's form (the copied `e2e/registration.spec.ts` shows
   the page object), and run `npm test`, `npm run lint`, `scripts/smoke-test-package.sh` and
   `npm run e2e` (Docker).
3. **Commit it as a feature** (`feat(event): publish <the camp> as its own package`) with a
   `Release-As: 1.0.0` footer, so the first release is 1.0.0, then create and push the repository:
   `gh repo create camphoric/camphoric-event-<name> --public --source . --remote origin --push`.
   Release-please opens its release PR on that push; if it can't, allow GitHub Actions to create
   pull requests in the repository's settings (Actions → General → Workflow permissions), as the
   other event repositories do, and re-run the Release Please workflow.
4. **Release it.** Approve the release PR's CI and e2e runs, then merge it: that tags `v1.0.0`
   and publishes the package. Check that the package is public and that the repository has Write
   (or Admin) under its "Manage Actions access".
5. **Add it to Camphoric:** in `data/`, `npm install @camphoric/camphoric-event-<name>` (a caret
   range from GitHub Packages), add it to `EVENTS` in `data/eventModules.ts`, and add a row to the
   table above. The offline tests then check that it's the published build, and `docker.yml`
   imports it.

---

## Workflows involved

| Workflow                              | Trigger                        | Does |
| ------------------------------------- | ------------------------------ | ---- |
| `.github/workflows/release-please.yml`| push to `main`                 | maintains the release PRs (the app's and each package's); on merge, tags + creates the GitHub Release, then builds assets (app) or publishes (packages) |
| `.github/workflows/prerelease.yml`    | push a `vX.Y.Z-*` tag          | creates the pre-release, then builds assets |
| `.github/workflows/release-assets.yml`| called by the two above        | builds `client/` and attaches `frontend-build-v2.tar.gz` to the tag |
| `.github/workflows/release-image.yml` | called by the two above        | builds the image at the tag and pushes `ghcr.io/camphoric/camphoric:<tag>` (+ `latest` for stable releases) |
| `.github/workflows/release-packages.yml` | called by `release-please.yml` when a package release PR merges, or run by hand with a tag | builds the event-import package at its tag and publishes it to GitHub Packages |
| `.github/workflows/data.yml`          | push/PR to `main` touching `data/` | type-checks, lints and tests the importer and the event packages, and smoke-tests the packed packages |
| `.github/workflows/docker.yml`        | push/PR to `main` touching `server/`, `client/`, `data/` or the Docker files | builds the image (never pushed), smoke-tests it against Postgres and imports every event into it, and runs Sample Camp's registration-form e2e tests against a throwaway server from it |
| `.github/workflows/events-latest.yml` | weekly, on demand, and PRs to `main` that change it or its scripts | moves the events `data/` installs from GitHub Packages to their newest versions, then tests and imports them; a failure (or an event with a newer major, or an org event repository whose package isn't installed) goes in an `event-compat` issue, which a clean run closes |
| `.github/workflows/client.yml`        | push/PR to `main` touching `client/` | type-checks, lints and unit-tests the client, and runs its Playwright e2e suite |

> The asset build is invoked directly by the two release workflows (not by a `release: published`
> trigger) because a release created with the default `GITHUB_TOKEN` does not start other
> workflows.
