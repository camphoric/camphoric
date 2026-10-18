Camphoric is implemented using the Django REST framework, postgres, and a
React client built with Vite.  This guide assumes that you're running on a
MacOS or Linux development machine.

Prerequisites
=============

To get started, install [docker](https://docs.docker.com/get-docker/). We
recommend the docker desktop version for your environment.

For homebrew users: `brew cask install docker;`

Using the development setup wizard
==================================

We have a setup wizard which will guide you through the process of setting up
the docker containers and services.  If you'd rather do it manually because
you like to learn by doing or you don't like installing unnecessary
dependencies, just [skip to the next section.](#setting-up-your-containerized-development-servers)

Run the following and follow the prompts:

```
./development_setup_wizard.py
```

It builds and starts the services (without the `data` service's background import), waits for the
admin the `django` service creates, then imports the events in the foreground
(`import --if-empty`).

Creating the docker services (the hard way)
===========================================

Keep reading if you want do set up all the docker containers yourself.  You'll
learn a lot about docker!

Setting up your containerized development servers
-------------------------------------------------

### Creating and editing your server's env files

First, copy the example env files to use as a template:

```
cp -R .env.example env
```

This will result in these env files.

- env/local/shared.env (settings every service reads, such as the `DJANGO_SUPERUSER_*` admin)
- env/local/django.env
- env/local/postgres.env
- env/local/react.env

The only one you'll need to edit is 'env/local/django' file where it says
'your-django-secret-key-here'. You'll do this in the next step.

You can edit most of the other values in these files if you know what you're
doing, but it's probably best to just keep them the same for development.

### Creating a secret key for your Django server

First you'll need to build the web and db docker containers for the server:

```
docker compose up --build -d -V
```

After this finishes, run `docker ps`. You should now see your postgres,
django, worker and react services running, with postgres reporting healthy:

```
❯ docker ps
CONTAINER ID   IMAGE                COMMAND                  CREATED         STATUS                   PORTS                              NAMES
9221cf257ca2   postgres:16-alpine   "docker-entrypoint.s…"   6 minutes ago   Up 6 minutes (healthy)   127.0.0.1:5434->5432/tcp           camphoric-postgres-1
9e5b365574e6   camphoric-worker     "./manage.py camphor…"   6 minutes ago   Up 4 minutes                                                camphoric-worker-1
df608d221bb8   camphoric-django     "bash -c './manage.p…"   6 minutes ago   Up 4 minutes             127.0.0.1:8000->8000/tcp           camphoric-django-1
1e66e583199e   node:26-bookworm     "docker-entrypoint.s…"   6 minutes ago   Up 6 minutes             127.0.0.1:3000-3001->3000-3001/tcp camphoric-react-1
```

Run the following command to get your secret key:

```
docker compose exec django python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

Copy the resulting secret key.  Open the 'env/local/django' file and replace
'your-django-secret-key-here' with the secret key created above.  You'll likely
want to put it in quotes since it sometimes has special characters that break
things.

### Running the server containers

Run the following to rebuild the django services with your new key:

```
docker compose up -d --force-recreate --no-deps --build django
```

### Upgrading the local database to PostgreSQL 16

The `postgres` service runs PostgreSQL 16. A `db` volume created by an older version (15) can't
be opened by 16, and the service fails to start ("database files are incompatible with
server"). Either start over with fresh sample data (the stack imports it when it starts on an
empty database):

```
docker compose down -v
docker compose up --build -d -V
```

or keep your data by dumping it with the old version first: before pulling this change, run
`docker compose exec postgres pg_dump -U camphoric camphoric > local.sql`; then, after
`docker compose down -v` and `docker compose up -d --wait postgres` (the database alone, so
nothing is created or imported before your data is back), restore it with
`docker compose exec -T postgres psql -U camphoric camphoric < local.sql`, and start the rest
with `docker compose up -d` (it finds your events, so imports nothing).

### Running the released image

The development stack above bind-mounts your source into a container running the ASGI server
with `--reload`. To run the
*release* image instead — the same image CI builds and every release publishes to
`ghcr.io/camphoric/camphoric` — use the separate compose file:

    docker compose -f docker-compose.image.yml up --build --wait

or `./run-docker`. It serves the app (with the v2 frontend) on http://localhost:8000 with an
`admin`/`admin` superuser bootstrapped. See [CONTAINER.md](../CONTAINER.md) for every
environment variable and mount point.

### Run the tests

To test that the setup went correctly run:

```
docker compose exec django python manage.py test --parallel auto
```

`--parallel auto` runs a worker per CPU, each on its own copy of the test database; leave it
out to run them one at a time. Add `--keepdb` to reuse the test database between runs.

### Validating the event data

`data/` is an npm workspace root. The root package is the importer (`loadAllData.ts`); the spec,
import-tools and Sample Camp are workspaces beside it, and the camps' events are installed from
their own repositories' packages (#780):

| Folder | Package | What it is |
| --- | --- | --- |
| `data/packages/event-import-spec` | `@camphoric/camphoric-event-import-spec` | the contract: the event import object's TypeBox schema and types, `validateEventImport()`, and the conformance tests every event runs (`@camphoric/camphoric-event-import-spec/conformance`) |
| `data/packages/import-tools` | `@camphoric/camphoric-event-import-tools` | the REST client, login, the event importer (`CamphoricEventCreator` and the organization loader, used by `loadAllData.ts`), the Playwright e2e scaffolding each event repository's registration-form tests are built on (`/e2e`), and the bulk-registration runner. It keeps its own copies of the spec types it uses (a test keeps them compatible), so it depends on no spec version |
| (GitHub Packages) | `@camphoric/camphoric-event-<name>` | a camp's event (listed in "Event repositories" in [RELEASE.md](../RELEASE.md)), developed in a repository of its own, `camphoric/camphoric-event-<name>`, with its organization, reports, sample and bulk registrations and e2e tests, and installed from GitHub Packages by a caret range |
| `data/events/sample-camp` | `@camphoric/camphoric-event-sample-camp` | Sample Camp: a made-up, anonymous event that uses as much of the import contract as it can, as an example of an event module and a test of importing every feature (lodging options, pricing overrides, payment options, admin fields, validation messages, legacy and server reports). A test fails when the contract's schema gains an event, report, registration type, custom charge type or lodging field, or a report output, that Sample Camp doesn't use. Its registration-form e2e tests (`e2e/`) run the import-tools page object against the real form, in CI against an image built from the change (`docker.yml`). It stays in this repository and is never published |

An event depends only on the spec package (and import-tools, for its bulk script and its e2e tests), imports only its
own files, and is loaded by package name from `data/eventModules.ts`. A root test checks that
every workspace imports only its own files and the packages it declares.

    cd data
    npm ci                                      # installs every workspace
    npm run typecheck                           # tsc --noEmit: the importer and every workspace
    npm test                                    # offline, no server needed: every event passes the
                                                # conformance checks and the server's schema checks,
                                                # then each workspace's own tests
    npm test -w events/sample-camp              # one package's tests
    npm run import                              # import every event into a running server (CAMPHORIC_URL,
                                                # default http://django:8000; a local one only, see below)
    npm run import -- --if-empty                # only into a server with no events
    npm run import -- --wait                    # wait for the server to start first
    CAMPHORIC_EVENTS=harmony,lark npm run import    # just these events, in this order
    CAMPHORIC_E2E_IMAGE=camphoric:local npm run e2e -w events/sample-camp
                                                # Sample Camp's registration-form e2e tests, against a
                                                # throwaway server from a locally built image
                                                # (docker build -t camphoric:local .; Playwright's
                                                # browsers: npx playwright install chromium; not npx
                                                # playwright test, which would load the packages' dist/)
    npm run build                               # compile the spec and import-tools to dist/ (for publishing)
    scripts/smoke-test-packages.sh              # pack them and use them with plain Node
    scripts/smoke-test-event-package.sh events/sample-camp   # build, pack and load an event from its build
                                                # (npm run build -w events/<name> needs the spec built first)

The importer, and every other tool that logs in through import-tools (the bulk-registration
scripts, an e2e run's import), only uses a local server: `localhost`, `127.0.0.1`, `::1`, a
`*.localhost` or `*.test` name, or the development stack's `django` service, so the Vagrant VM's
and the Docker data service's imports work as they are. Importing replaces any event with the same
name and deletes its lodging, so a stray `CAMPHORIC_URL` (say, in `data/.env`) mustn't reach a live
server: any other server is refused before anything is sent to it. Set `CAMPHORIC_ALLOW_REMOTE=1`
to use one deliberately. A request whose connection is reset is sent again only when that's safe
(GET, PUT and DELETE): a POST or PATCH the server may already have applied fails instead.

A camp's event lives in a repository of its own: see "Event repositories" in
[RELEASE.md](../RELEASE.md) for the camps' repositories and for adding one. In this repository, an
event is added by its package name: installed from GitHub Packages by a caret range (`npm install
@camphoric/camphoric-event-<name>` in `data/`) and listed in `EVENTS` in `data/eventModules.ts`.
Each event takes the spec as a peer dependency, so the importer and every event share one copy (see
"What a spec version means" in RELEASE.md). The offline tests check that each installed event is
the published build, from `dist/`, resolved from GitHub Packages and taking a spec range this
repository's spec satisfies, and that events naming the same organization declare it identically.
To work on a camp's event against your development server, clone its repository; each has its own
tests, e2e tests and (where the camp has one) bulk-registration script.

The packages are TypeScript. The spec and import-tools are published to GitHub Packages compiled
to JS (their `exports` point at `dist/`; see "Event import packages" in the
[README](../README.md) and [RELEASE.md](../RELEASE.md)), but in this repository everything runs from
their source, with no build: the `camphoric-source` export condition, which the tsconfigs
(`customConditions`), Jest configs (`customExportConditions`) and every `tsx
--conditions=camphoric-source` run set, resolves them to their `.ts` files. A test checks that
nothing in the repository runs without it. Sample Camp builds the way a camp's own repository
builds and publishes its event (`npm run build -w events/sample-camp` after `npm run build`, from
its `index.ts` to `dist/`), packing its build and its `reports/` templates, and finds its report
templates from its package root (`packagePath.ts`), which works from either; a published event's
package drops the `camphoric-source` export, since its source isn't packed. Each event's `index.ts` default export
`satisfies EventModule`, and the import object's type (`EventImport`) and its JSON Schema both come
from the TypeBox schema in the spec package, so a mistake shows up in the editor; the importer
still checks the schema with Ajv at runtime. After pulling a change to the workspaces or to the
events `data/` installs (such as an event moving to GitHub Packages), rebuild the `data` Docker
image (`docker compose build data`) before `docker compose run --rm data import`, and start the
stack with `docker compose up -d -V`: `-V` gives the `data` service a fresh `node_modules` volume,
where an old one would still hold the previous install.
`data/` installs events from GitHub Packages, so `npm ci` there needs a token with
`read:packages`: in `~/.npmrc` on your machine, `CAMPHORIC_NPM_AUTH_TOKEN=$(gh auth token)
docker compose build data` for the image, and `CAMPHORIC_NPM_AUTH_TOKEN` or the vault for the
Vagrant VM. See "A token for `data/`" in the [README](../README.md#a-token-for-data).

A syntax error or a bad schema in any single event fails only that event's block. CI type-checks
and runs the offline suite, then smoke-tests the packed packages, on every pull request that
touches `data/` (`.github/workflows/data.yml`) and
imports every event into the freshly built release image (`.github/workflows/docker.yml`); a
rejected sample registration fails that import. The same workflow runs Sample Camp's
registration-form e2e tests against a throwaway server from that image, so a client change that
breaks the import-tools page object fails there. The server's legacy report tests
(`server/tests/test_templating_legacy.py`, in `django.yml`) render the reports of the events
`data/` installs from GitHub Packages as well as those under `data/events/`. Those other workflows
test the event versions the lockfile pins; every week, `.github/workflows/events-latest.yml` moves
each to the newest version its range allows and tests and imports them again, opening an
`event-compat` issue when they fail, when an event has a newer major than its range, or when the
camphoric org has an event repository (`camphoric-event-<name>`) whose package `data/` doesn't
install. `node scripts/registry-events.mjs`
lists the events `data/` installs from GitHub Packages, and `scripts/latest-events-notes.sh` gives
those notes.

### Create the Django superuser

This user is the one that you'll use to log in with on the front end (a superuser is always a
Camphoric Admin). The `django` service creates it from `DJANGO_SUPERUSER_*` in
`env/local/shared.env` when it starts on a fresh database. For another one, run the following and
follow the onscreen instructions (with a different username):

```
docker compose exec django bash -c "./manage.py createsuperuser"
```

Other users are added on the admin's Users screen, each with a Camphoric permission group
(Admin, Registrar or Reporter). With the console mail backend, their set-password link is in the
worker's log; or print one with `./manage.py camphoric_password_link <username> --base-url
http://localhost:3000`.

### Load the sample data

On a fresh database, `docker compose up` creates the admin (`DJANGO_SUPERUSER_*` in
`env/local/shared.env`) and imports every event the importer loads (the camps and Sample Camp, from
`data/eventModules.ts`): the `data` service runs `import --if-empty`, which waits for the server,
imports, and exits. A database that already has events is left alone, as the Vagrant VM's is when
it's provisioned (importing an event again deletes and recreates its lodging and unassigns its
campers). If that first import is interrupted or fails, `docker compose logs data` says so; start
again with `./data/reset-data-and-test`, which flushes the database first. Rebuild with
`docker compose up --build -d -V`: the `-V` gives the `data` service a fresh `node_modules` for the
rebuilt image (otherwise it keeps the old container's).

To import again, into a database that already has events:

```bash
./data/reset-data-and-test
```

That flushes the database first. `docker compose run --rm data import` imports without flushing
(it starts the server if it isn't running, and waits for it). Add `--no-deps` for what doesn't need
the server, such as `docker compose run --rm --no-deps data npm test`.

### View loaded data

To access the browsable API open this url in your browser: [http://127.0.0.1:8000/api/](http://127.0.0.1:8000/api/)

You'll want to login using your superuser credentials to see all the data.

### View the app

Go to [http://localhost:3000/](http://localhost:3000/)

Frontend development process
----------------------------

The `react` service runs the frontend (`client/`) on
[Vite's dev server](https://vite.dev/guide/), which reloads when it detects edits
and proxies `/api` to the `django` service. See
[`client/README.md`](../client/README.md) for the frontend's own commands.

The service installs its npm modules (`npm ci`) each time it starts, so after
`client/package.json` or its lockfile changes, restart it:

```
docker compose restart react
```

Server development process
--------------------------

The Django server will automatically reload when you change any .py files.

### First step: rebuilding and starting the server containers

Run the following to rebuild the database and django containers:

```
docker compose up --build -d -V
```

You'll want to do this every time when you start development.

Note:

- This won't delete any of the existing database files.

### Writing tests

It is recommended that you write tests. All tests are run when you run the
`docker compose exec django python manage.py test --parallel auto` command (see
[Run the tests](#run-the-tests)).

It is recommended that you look at the existing tests in the 'server/tests/'
directory.  These should give you a good idea about what tests exist, and how
you might write new ones.

For information about writing tests in Django, see the [Django test docs](https://docs.djangoproject.com/en/3.2/topics/testing/overview/)
and the [Django REST api test docs](https://www.django-rest-framework.org/api-guide/testing/).

### Database migrations

To make changes to the models (database schema), e.g. to add a model field
(database column), refer to the [Django documentation on
migrations](https://docs.djangoproject.com/en/3.2/topics/migrations/). There are
a few differences due to the Docker setup. The `manage.py makemigrations`
command may fail with "Permission denied" unless you (temporarily) loosen the
permissions on the migations directory. Here's the sequence of commands you
might use after editing models.py:

    chmod 777 server/camphoric/migrations
    docker compose exec django python manage.py makemigrations
    chmod 755 server/camphoric/migrations
    docker compose exec django python manage.py migrate

### Connecting to the database from the host

If you like using a database GUI tool like [Beekeeper Studio](https://www.beekeeperstudio.io/)
or [pgAdmin](https://www.pgadmin.org/), you can use the following to connect:

- The username, password, and database name is in 'env/local/postgres'
- The server is exposed on port 5434, on the host's loopback only

If using the env defaults, this should be [postgres://camphoric:camphoric@localhost:5434/camphoric](postgres://camphoric:camphoric@localhost:5434/camphoric)

### Reaching the stack from another device

`docker-compose.yml` publishes every port on 127.0.0.1 only, so other machines
on your network can't reach the stack: Postgres has a known password, Django
runs with DEBUG on and an admin/admin login, and after a live-data restore the
database holds real people's details. To try the app from another device (a
phone on your LAN, say), add a `docker-compose.override.yml` (which `docker
compose` reads by itself) that republishes the ports you need on every
interface, and don't commit it. `!override` needs Compose 2.24 or later:

```yaml
services:
  react:
    ports: !override
      - "3000:3000"
      - "3001:3001"
```

That's enough to load the frontend and register anonymously. Signing in from
the device is a POST that Django's CSRF check refuses (403) until the device's
origin is trusted: set `CSRF_TRUSTED_ORIGINS` in `env/local/django.env` and run
`docker compose up -d django` (a plain restart doesn't reread the file). The
variable replaces the default list in
`server/camphoric_server/settings_default.py`, so repeat those defaults and add
`http://<your-LAN-IP>:3000`. If you republish `django`'s 8000 as well, also set
`ALLOWED_HOSTS` (again, the defaults plus your LAN IP); otherwise Django answers
requests on that port with a 400 (DisallowedHost).

Remove the override and those settings, and run `docker compose up -d` again,
when you're done. The Vagrant VM's forwarded ports are bound the same way; see
[VM_DEV_SETUP.md](../VM_DEV_SETUP.md).

Tips for working with docker
============================

Official docs
-------------

- [docker official documentation home](https://docs.docker.com/)
- [docker cli](https://docs.docker.com/engine/reference/commandline/cli/)
- [docker compose cli](https://docs.docker.com/compose/reference/)

Helpful Hints and How-Tos
-------------------------

### Detached vs non-detached

When running `docker compose up --build -d`, the -d means run it "detached", or
in the background.  This means that you'll not see any logging output in your
terminal, but see the section on log output below on how to view it.  If you
would rather just see the output continuously, just run this command without
the -d.

### Rebuilding only one service

If you need to just rebuild one service (ex you're iterating on the
docker-compose.yml file or the server's Pipfile) you can use the `--no-deps`
flag and specify the service to rebuild a service individually.  Example of
rebuilding only the django service:

```
docker compose up -d --no-deps --build django
```

Additional flags that may be handy here:

- --force-recreate - Recreate containers even if their configuration and image
  haven't changed.

### Running commands in a container

You can use the [docker compose exec](https://docs.docker.com/compose/reference/exec/)
command to run arbitrary commands inside of a container:

- Open a shell in the web container: `docker compose exec django bash`
- Run a command (like `ls`): `docker compose exec django ls -la`
- Find out what npm version we're running: `docker compose exec react npm --version`
- Install a new npm package for the client: `docker compose exec react npm install <pkgname>`

### Seeing server log output

If you installed the Docker Desktop app, you can view the logs by going to:

```
Containers/Apps ➡ [compose dir] ➡ [container name]
```

Here you can view the logs, stats, environment variables, mount points, etc.

If you'd prefer to use the command line, you can use the [docker logs command](https://docs.docker.com/engine/reference/commandline/logs/).

```
docker compose logs -f django
```

### Container/image/volume removal

**Delete all containers**

If you want to PERMANENTLY delete camphoric's containers, anonymous volumes,
network and built images (the database volume, other projects' artifacts and
pulled images such as postgres are left alone):

```
./remove-all-docker-artifacts
```

Add `-d` to delete the database volume too.

use `./remove-all-docker-artifacts -h` for more details

**Delete unused artifacts**

If you just want to clean up some hard drive space (this prunes the unused
images and unused anonymous volumes of every project on the machine, not only
camphoric's; named volumes such as the database are kept):

```
./remove-unused-docker-artifacts
```

use `./remove-unused-docker-artifacts -h` for more details
