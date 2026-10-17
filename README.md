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
  diagrams.

## Releases

Deploys are pinned to a **version** (`vX.Y.Z`). Each release is a GitHub Release carrying the repo
source plus the built frontend (`frontend-build-v2.tar.gz`), cut with
[release-please](https://github.com/googleapis/release-please) from
[Conventional Commits](https://www.conventionalcommits.org/). See **[RELEASE.md](./RELEASE.md)**.
Each release also publishes a container image to `ghcr.io/camphoric/camphoric` — see
**[CONTAINER.md](./CONTAINER.md)**.

## Event import packages (GitHub Packages)

The contract a camp's event definition satisfies, and the tools around it, are public npm packages
on [GitHub Packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry),
released on their own versions (see [RELEASE.md](./RELEASE.md)):

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
`camphoric/camphoric-event-<name>`, and published there as `@camphoric/camphoric-event-<name>`
(see "Event repositories" in [RELEASE.md](./RELEASE.md)); `data/` installs them from GitHub
Packages, so **installing `data/` needs a token** (see [below](#a-token-for-data)), as does
installing any of these packages anywhere else.

GitHub Packages needs a token to install **even public packages**:

1. Point the `@camphoric` scope at GitHub Packages in the project's `.npmrc` (commit this line;
   it also keeps the scope from ever resolving to npmjs):

   ```
   @camphoric:registry=https://npm.pkg.github.com
   ```

2. Give npm a token with the `read:packages` scope (a classic personal access token, or the GitHub
   CLI's), never in a committed file:

   ```bash
   gh auth refresh -s read:packages
   ```

   ```bash
   npm config set //npm.pkg.github.com/:_authToken "$(gh auth token)"
   ```

   The second command writes the token to your `~/.npmrc`.

3. **In GitHub Actions**, use the job's own token:

   ```yaml
   permissions:
     contents: read
     packages: read
   steps:
     - uses: actions/setup-node@v7
       with:
         node-version: 22
         registry-url: https://npm.pkg.github.com
         scope: '@camphoric'
     - run: npm ci
       env:
         NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
   ```

   That installs public packages, such as these two, in any repository. A private package
   installs in the repository it's linked to (when it inherits that repository's access, the
   default) and in any repository it grants read access to under "Manage Actions access" in its
   settings ([GitHub's docs](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility#ensuring-workflow-access-to-your-package));
   anywhere else, store a token with `read:packages` as a secret instead.

4. **In a Docker build**, pass the token as a build secret rather than an argument or a file, so
   it isn't kept in the image. The secret is only in the install step's environment, and a config
   file on a tmpfs points npm at it (an `${CAMPHORIC_NPM_AUTH_TOKEN}` in the project's `.npmrc`
   would break npm wherever the variable isn't set):

   ```dockerfile
   # syntax=docker/dockerfile:1
   RUN --mount=type=secret,id=npm_token,env=CAMPHORIC_NPM_AUTH_TOKEN,required=false \
       --mount=type=tmpfs,target=/run/npm \
       if [ -n "$CAMPHORIC_NPM_AUTH_TOKEN" ]; then \
         echo '//npm.pkg.github.com/:_authToken=${CAMPHORIC_NPM_AUTH_TOKEN}' > /run/npm/npmrc; \
         export NPM_CONFIG_USERCONFIG=/run/npm/npmrc; \
       fi; \
       npm ci
   ```

   with `docker build --secret id=npm_token,env=CAMPHORIC_NPM_AUTH_TOKEN …`, or `secrets:` in a
   compose file's `build:`. BuildKit doesn't count a secret in its cache key, so after adding a
   token, rebuild with `--no-cache` if the install step was cached from a build without one.

### A token for `data/`

`data/` installs events from GitHub Packages, so everything that runs its `npm ci` needs a token
with `read:packages`:

- **CI** (`data.yml`, `docker.yml`, `django.yml`, `events-latest.yml`, `release-packages.yml`): the job's own `GITHUB_TOKEN`, with
  `packages: read`, as `NODE_AUTH_TOKEN` (the variable `actions/setup-node`'s npm config reads).
  That's enough for public packages. A private package published from another repository, such
  as a camp's events, installs only if it grants this repository read access: in its settings,
  add `camphoric/camphoric` under "Manage Actions access" ([GitHub's docs](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility#ensuring-workflow-access-to-your-package)).
  This repository is public, and GitHub warns that forks of a public repository given access to
  a private package may be able to read it, so grant that only to a package that can stand to
  leak.
- **Your machine:** `~/.npmrc`, as in step 2 above.
- **The `data` Docker image** (`docker-compose.yml`): the `npm_token` build secret, taken from
  `CAMPHORIC_NPM_AUTH_TOKEN` when you build:

  ```bash
  CAMPHORIC_NPM_AUTH_TOKEN=$(gh auth token) docker compose build data
  ```

- **The Vagrant VM** (ansible): `camphoric_npm_token`, from `CAMPHORIC_NPM_AUTH_TOKEN` where
  ansible runs (`CAMPHORIC_NPM_AUTH_TOKEN=$(gh auth token) vagrant provision`), or else
  `camphoric_vault_npm_token` in your vault (see [VM_DEV_SETUP.md](./VM_DEV_SETUP.md#vault-setup-instructions)). Before
  `npm ci`, the playbook writes it to the VM user's `~/.npmrc`.
