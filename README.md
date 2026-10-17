# Camphoric

Camphoric is a camp registration and administration system. It has two parts:

- **`server/`** — a Django + Django REST Framework backend (the source of truth for data, pricing,
  persistence, and email).
- **`client/`** — a React + TypeScript single-page app with two surfaces: a public **registration**
  flow and an authenticated **admin** back-office. (`client_v2/` is an in-progress rebuild.)

## Documentation

- **[RELEASE.md](./RELEASE.md)** — how versioned releases are cut and deployed.
- **[CONTAINER.md](./CONTAINER.md)** — the container image: environment variables, mount points,
  and how to run it.
- **[SPEC_CLIENT_V2.md](./SPEC_CLIENT_V2.md)** — behavior and architecture of the client rebuild.
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — coding standards and contribution guidelines.
- **[doc/](./doc)** — development and operational notes, including
  **[doc/payments.md](./doc/payments.md)**: how payments, invoices, refunds and PayPal work, with
  diagrams.

## Releases

Deploys are pinned to a **version** (`vX.Y.Z`). Each release is a GitHub Release carrying the repo
source plus the built frontends (`frontend-build.tar.gz` and `frontend-build-v2.tar.gz`), cut with
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
- **`@camphoric/camphoric-event-import-tools`** — the Camphoric REST client, login, and the
  bulk-registration runner.

Their source is in [`data/packages/`](./data/packages). Within this repository the importer and
the events use them as npm workspaces (from source), so **nothing here needs a token yet** — not
local development, the `data` Docker image, the Vagrant VM or CI. You need one to install them
anywhere else, such as an event's own repository.

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

   A repository outside the `camphoric` organization needs a token with `read:packages` stored as
   a secret instead.

4. **In a Docker build**, pass the token as a build secret rather than an argument, so it isn't
   kept in the image:

   ```dockerfile
   RUN --mount=type=secret,id=npm_token \
       NODE_AUTH_TOKEN="$(cat /run/secrets/npm_token)" npm ci
   ```

   with an `.npmrc` holding `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}` next to the
   scope line, and `docker build --secret id=npm_token,env=NODE_AUTH_TOKEN …` (or `secrets:` in a
   compose file's `build:`).
