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
[`version.txt`](./version.txt) (kept in sync with `client/package.json`).

---

## How a stable release is triggered

Releases are **PR-gated** — nothing is released just by pushing to `main`:

1. **Every push to `main`** runs the *Release Please* workflow. It does **not** cut a release; it
   opens or updates a single standing **release PR** (e.g. *"chore(main): release 0.2.0"*) that
   accumulates the next version bump (`version.txt`, `client/package.json`) and `CHANGELOG.md`
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

## Workflows involved

| Workflow                              | Trigger                        | Does |
| ------------------------------------- | ------------------------------ | ---- |
| `.github/workflows/release-please.yml`| push to `main`                 | maintains the release PR; on merge, tags + creates the GitHub Release, then builds assets |
| `.github/workflows/prerelease.yml`    | push a `vX.Y.Z-*` tag          | creates the pre-release, then builds assets |
| `.github/workflows/release-assets.yml`| called by the two above        | builds `client/` and `client_v2/` and attaches `frontend-build.tar.gz` + `frontend-build-v2.tar.gz` to the tag |
| `.github/workflows/release-image.yml` | called by the two above        | builds the image at the tag and pushes `ghcr.io/camphoric/camphoric:<tag>` (+ `latest` for stable releases) |
| `.github/workflows/docker.yml`        | push/PR to `main` touching `server/`, `client_v2/`, `data/` or the Docker files | builds the image (never pushed) and smoke-tests it against Postgres |
| `.github/workflows/client-v2.yml`     | push/PR to `main` touching `client_v2/` | type-checks, lints and unit-tests the v2 client, and runs its Playwright e2e suite |
| `.github/workflows/react.yml`         | push/PR to `main` touching `client/` | unchanged — the continuous `js-build-main` dev build |

> The asset build is invoked directly by the two release workflows (not by a `release: published`
> trigger) because a release created with the default `GITHUB_TOKEN` does not start other
> workflows.
