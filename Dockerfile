# syntax=docker/dockerfile:1.7
#
# Camphoric application image: the Django/DRF server (gunicorn) with the v2
# frontend (client_v2/) baked in and served from the same origin. See CONTAINER.md
# for the environment variables, mount points and how to run it.
#
# Stages:
#   frontend     - builds client_v2 with Vite -> /frontend/build (index.html + static/)
#   python-deps  - resolves server/Pipfile.lock into a venv (runtime deps only)
#   app          - slim runtime image: venv + server/ + built frontend, non-root, gunicorn

ARG NODE_VERSION=22
ARG PYTHON_VERSION=3.12

# ---- frontend: build client_v2 -------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS frontend
WORKDIR /frontend
# Lockfile first so the npm ci layer is cached across source edits.
COPY client_v2/package.json client_v2/package-lock.json ./
RUN npm ci
COPY client_v2/ ./
# tsc -b && vite build; vite-plugin-checker (typescript + eslint) gates the image build.
RUN npm run build

# ---- python-deps: Pipfile.lock -> venv (runtime deps only) ---------------------
FROM python:${PYTHON_VERSION}-slim AS python-deps
ENV PIP_NO_CACHE_DIR=1 \
    PIPENV_VENV_IN_PROJECT=1
# psycopg2 ships no wheels and builds from source, so we need a full C toolchain with the
# libc headers (build-essential) and libpq-dev; libffi-dev covers cffi on platforms without
# a wheel. They stay in this stage only.
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential libpq-dev libffi-dev \
 && rm -rf /var/lib/apt/lists/* \
 && pip install pipenv
WORKDIR /app
COPY server/Pipfile server/Pipfile.lock ./
# --deploy fails if Pipfile.lock is out of date with Pipfile; no --dev packages.
RUN pipenv install --deploy

# ---- app -----------------------------------------------------------------------
FROM python:${PYTHON_VERSION}-slim AS app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH=/app/.venv/bin:$PATH \
    DJANGO_SETTINGS_MODULE=camphoric_server.settings \
    STATIC_ROOT=/app/static
# libpq5 for psycopg2; postgresql-client provides pg_dump for `manage.py dbbackup`.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libpq5 postgresql-client \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system backend \
 && useradd --system --gid backend --home-dir /app --shell /usr/sbin/nologin backend
WORKDIR /app
COPY --from=python-deps /app/.venv /app/.venv
COPY server/ ./
COPY --from=frontend /frontend/build ./frontend_bootstrap/build
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/camphoric-entrypoint
# collectstatic at build time. Settings must import to do so, hence the placeholder
# values; they are passed inline to this one command and are not persisted in the image.
RUN SECRET_KEY=build-only DATABASE_URL=sqlite:////tmp/build.sqlite3 \
    PAYPAL_BASE_URL=unused PAYPAL_SECRET=unused \
    python manage.py collectstatic --no-input \
 && mkdir -p /app/backup \
 && chown -R backend:backend /app/backup /app/static
USER backend
EXPOSE 8000
# /api/set-csrf-cookie is unauthenticated; 127.0.0.1 is in the default ALLOWED_HOSTS.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/set-csrf-cookie', timeout=3)" || exit 1
ENTRYPOINT ["camphoric-entrypoint"]
# Tune workers etc. at runtime with GUNICORN_CMD_ARGS rather than overriding CMD.
CMD ["gunicorn", "camphoric_server.wsgi", "--bind", "0.0.0.0:8000", "--workers", "3", \
     "--access-logfile", "-", "--error-logfile", "-"]
