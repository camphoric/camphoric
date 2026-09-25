# Running Camphoric as a container

The application image bundles the Django/DRF server (served by gunicorn) with the **v2
frontend** (`client_v2/`) baked in and served from the same origin. It is built by the root
[`Dockerfile`](./Dockerfile) and published on every release to GitHub Container Registry:

```
ghcr.io/camphoric/camphoric:vX.Y.Z      # each release
ghcr.io/camphoric/camphoric:latest      # newest *stable* release (pre-releases never move it)
```

- GHCR docs: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- Publishing from Actions: https://docs.github.com/en/actions/publishing-packages/publishing-docker-images
- Pricing: https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-packages/about-billing-for-github-packages
  — GitHub Packages is **free for public repositories** (unlimited storage and transfer, no
  pull-rate limits), which `camphoric/camphoric` is.

The database is **not** in the image: point `DATABASE_URL` at a PostgreSQL server.

---

## Quick start

```bash
# Build locally and run with a throwaway Postgres (admin/admin bootstrapped):
docker compose -f docker-compose.image.yml up --build --wait
# ...or run a published release the same way:
CAMPHORIC_IMAGE=ghcr.io/camphoric/camphoric:v0.3.0 docker compose -f docker-compose.image.yml up --wait
# App: http://localhost:8000     Admin: http://localhost:8000/django-admin/
# If something else already listens on 8000 (e.g. the Vagrant VM forwards its Django there),
# pick another host port:  CAMPHORIC_PORT=8010 docker compose -f docker-compose.image.yml up --wait
```

`./run-docker` does the same in the foreground. Or with plain Docker against your own database:

```bash
docker run --rm -p 8000:8000 \
  -e SECRET_KEY=change-me \
  -e DATABASE_URL=postgres://camphoric:secret@db.example.org:5432/camphoric \
  -e PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com -e PAYPAL_SECRET=... \
  -e ALLOWED_HOSTS=localhost,127.0.0.1 -e SESSION_COOKIE_SECURE=false \
  ghcr.io/camphoric/camphoric:latest
```

---

## Environment variables

Configuration is **process environment only** — the image reads no `.env` file (`ENV_PATH`
is unused). Values marked *required* have no default; the container will not boot without them
(`django.core.exceptions.ImproperlyConfigured`).

### Required

| Variable          | Purpose                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `SECRET_KEY`      | Django secret key. Generate a long random string; keep it stable across restarts.             |
| `DATABASE_URL`    | PostgreSQL connection URL, e.g. `postgres://user:password@host:5432/dbname`.                  |
| `PAYPAL_BASE_URL` | `https://api-m.sandbox.paypal.com` (sandbox) or `https://api-m.paypal.com` (live).            |
| `PAYPAL_SECRET`   | PayPal REST API secret. (The client id is per-event data, not an environment variable.)       |

### Django / security

| Variable                | Default                              | Purpose                                                                                                                  |
| ----------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `DEBUG`                 | `false`                              | Django debug mode. Never `true` in production.                                                                           |
| `ALLOWED_HOSTS`         | `localhost,127.0.0.1,django`         | Comma-separated hostnames Django will serve. **Keep `127.0.0.1`** — the image's healthcheck uses it.                     |
| `CSRF_TRUSTED_ORIGINS`  | local dev origins                    | Comma-separated full origins (`scheme://host[:port]`) allowed to POST, e.g. `https://register.example.org`.              |
| `SESSION_COOKIE_SECURE` | `true`                               | Session cookie only over https. Set `false` for plain http on a non-localhost host (browsers exempt `localhost`).        |
| `CSRF_COOKIE_SECURE`    | `false`                              | Set `true` when serving over https.                                                                                      |
| `USE_X_FORWARDED_PROTO` | `false`                              | Set `true` behind a proxy that terminates TLS (nginx, an ingress) so Django treats requests as https.                    |
| `DJANGO_LOG_LEVEL`      | `INFO` (`DEBUG` when `DEBUG=true`)   | Console log level. Logs go to stdout/stderr.                                                                             |
| `STATIC_ROOT`           | `/app/static`                        | Where static files were collected at build time. Leave as is.                                                            |
| `CORS_ORIGIN_WHITELIST` | `= CSRF_TRUSTED_ORIGINS`             | **Unused** (`django-cors-headers` is not installed); accepted only for compatibility with old override files.            |

### Templates

| Variable                      | Default               | Purpose                                                                                                          |
| ----------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `CAMPHORIC_TEMPLATE_TIMEZONE` | `America/Los_Angeles` | Time zone that dates and times are shown in by server-rendered reports and emails.                               |
| `CAMPHORIC_PUBLIC_URL`        | *(empty)*             | The public site's address, e.g. `https://register.example.org`. Used for registration links in templates; when empty, links are derived from the current request (so bulk email and template checks have none). |

### Email

| Variable              | Default                                        |
| --------------------- | ---------------------------------------------- |
| `EMAIL_BACKEND`       | `django.core.mail.backends.console.EmailBackend` (prints mail to the log) |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | unset |
| `EMAIL_USE_TLS`       | `true`                                         |
| `EMAIL_USE_SSL`       | `false`                                        |
| `EMAIL_TIMEOUT`       | `30`                                           |

Per-event sending accounts can also be configured in the admin (Email accounts).

### Backups (django-dbbackup)

| Variable                  | Default                                        |
| ------------------------- | ---------------------------------------------- |
| `DBBACKUP_STORAGE`        | `django.core.files.storage.FileSystemStorage` (an empty value counts as unset) |
| `DBBACKUP_STORAGE_OPTIONS`| `{"location": "/app/backup"}` (JSON; empty or `{}` counts as unset) |

Run a backup with `docker exec <container> python manage.py dbbackup`; mount `/app/backup` to
keep the files (see *Mount points*). The image ships the PostgreSQL 17 client (`pg_dump`, from
the base image's Debian release), which can dump servers up to PostgreSQL 17.

These two variables populate `STORAGES["dbbackup"]` in the settings. If you configure backups
from a mounted `settings_override.py` instead, set `STORAGES["dbbackup"]` there — django-dbbackup
rejects the legacy `DBBACKUP_STORAGE` / `DBBACKUP_STORAGE_OPTIONS` settings.

### Entrypoint controls

| Variable                                                      | Default | Purpose                                                                                     |
| ------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| `DJANGO_SUPERUSER_USERNAME` / `_PASSWORD` / `_EMAIL`          | unset   | When username **and** password are set, an admin user is created on boot (idempotent).      |
| `CAMPHORIC_SKIP_MIGRATE`                                      | `0`     | `1` skips `manage.py migrate` at start (e.g. when running several replicas).                |
| `GUNICORN_CMD_ARGS`                                           | unset   | Extra gunicorn options, e.g. `--workers 5 --timeout 60`, without overriding the `CMD`.      |

---

## Mount points

There are exactly two, and both are optional:

| Path                                          | Mode | Purpose                                                                                  |
| --------------------------------------------- | ---- | ---------------------------------------------------------------------------------------- |
| `/app/backup`                                 | rw   | Output of `manage.py dbbackup`. The **only** writable path meant to persist.             |
| `/app/camphoric_server/settings_override.py`  | ro   | Optional Django settings override file (see *Customizing Django settings*).              |

Everything else is baked in or ephemeral: the database is external (`DATABASE_URL`), static
files are collected into the image at build time, logs go to stdout, and the app has no user
uploads. There are no other volumes to hunt for.

---

## Customizing Django settings

The server's settings are layered:

```
DJANGO_SETTINGS_MODULE=camphoric_server.settings
  settings.py             -> from settings_default import *        (shipped in the image)
                             try: from settings_override import *  (optional, NOT in the image)
  settings_default.py     -> the single source of truth; reads environment variables
```

`settings_default.py` and `settings.py` are in the image. **`settings_override.py` is
deliberately excluded** (it is gitignored *and* in `.dockerignore`) so that no host-specific
configuration is ever baked into a published image; the `try/except ImportError` means the
container boots fine without it.

**Preferred — environment variables.** Every common setting is env-driven (see the tables
above). This is what `docker-compose.image.yml` and CI use.

**Escape hatch — mount an override file.** For anything not env-driven, or arbitrary Python
(custom `LOGGING`, extra `INSTALLED_APPS`, per-deploy tweaks), bind-mount a file at
`/app/camphoric_server/settings_override.py`. Python resolves it as part of the
`camphoric_server` package and imports it last. This is the same file the Vagrant provisioning
renders today — just delivered as a mount instead of written to disk — so existing override
files work unchanged:

```bash
docker run ... -v ./settings_override.py:/app/camphoric_server/settings_override.py:ro ...
```
```yaml
# docker-compose.image.yml (or your own compose file)
services:
  app:
    volumes:
      - ./settings_override.py:/app/camphoric_server/settings_override.py:ro
```

**Precedence:** mounted `settings_override.py` **>** environment variable **>** built-in
default. An override that assigns `ALLOWED_HOSTS = [...]` beats the `ALLOWED_HOSTS` env var,
because `settings_default.py` reads the environment and the override is imported after it. An
override may itself read the environment (`import os` / `environ`) if it wants both.

Notes: a read-only mount is fine (nothing is written next to it and bytecode writing is off);
the file is imported once at startup, so changes need a container restart; keep secrets out of
it if it lives in a repository — prefer environment variables for those.

**Inspecting the effective settings:**

```bash
docker exec <container> python manage.py diffsettings --output unified
```

prints every setting that differs from Django's defaults — the definitive answer to "what is
`ALLOWED_HOSTS` right now?", whichever layer set it.

*Alternative (rarely needed):* point `DJANGO_SETTINGS_MODULE` at a module in a mounted
directory on `PYTHONPATH` (e.g. mount `/config`, set `PYTHONPATH=/config` and
`DJANGO_SETTINGS_MODULE=my_settings`, where `my_settings.py` does
`from camphoric_server.settings import *` and overrides). The override-file mount above is
simpler and matches the existing convention.

---

## Ports, healthcheck, startup

- **Port `8000`** — gunicorn (3 workers by default; tune with `GUNICORN_CMD_ARGS`).
- **Healthcheck** — `GET http://127.0.0.1:8000/api/set-csrf-cookie` (unauthenticated) every 30s,
  40s start period. Hence `127.0.0.1` in `ALLOWED_HOSTS`.
- **Startup** (`docker/entrypoint.sh`): `manage.py migrate` (retried up to 10× while the database
  comes up) → optional superuser bootstrap → `exec gunicorn`. Running migrations at boot assumes a
  single instance; for replicas set `CAMPHORIC_SKIP_MIGRATE=1` and migrate separately.
- Runs as the non-root `backend` user; `PYTHONUNBUFFERED=1` so logs stream immediately.

## Behind a reverse proxy (TLS termination)

```
USE_X_FORWARDED_PROTO=true
SESSION_COOKIE_SECURE=true         # the default
CSRF_COOKIE_SECURE=true
ALLOWED_HOSTS=register.example.org,127.0.0.1
CSRF_TRUSTED_ORIGINS=https://register.example.org
```

Proxy `/` to the container's port 8000; the image serves the SPA and `/static/*` itself
(whitenoise), so no separate static file root is needed.

## Ad-hoc management commands

```bash
docker exec -it <container> python manage.py createsuperuser
docker exec <container> python manage.py dbbackup
docker exec <container> python manage.py diffsettings --output unified
```

---

## Building and verifying locally

```bash
docker build -t camphoric:local .
# No secrets or dev tooling in the image:
docker run --rm camphoric:local sh -c 'test ! -e /app/.env && test ! -e /app/camphoric_server/settings_override.py && echo ok'
# Boots, serves the SPA and static assets with DEBUG off:
docker compose -f docker-compose.image.yml up --build --wait
curl -fsS http://localhost:8000/ | grep -q 'id="root"' && echo SPA ok
docker compose -f docker-compose.image.yml down -v
```

CI runs the same checks on every pull request that touches the image's inputs
(`.github/workflows/docker.yml`); releases publish
the image via `.github/workflows/release-image.yml`, which can also be run by hand:
`gh workflow run release-image.yml -f tag=vX.Y.Z`.
