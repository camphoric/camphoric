# Running the backend for client_v2 development

`client_v2` is a static SPA that talks to the Django API at `/api`. In dev the Vite server
proxies `/api` to the backend (default `http://localhost:8000/`, override with `VITE_API_PROXY`).
So all you need running locally is the Django API on `:8000` — you do **not** need the full VM.

> These are working notes for now; they may be folded into the main repo docs later.

## Recommended: Docker Compose (daily driver)

The repo's `docker-compose.yml` (at the repo root) already defines `postgres` + `django` services.
For frontend work, bring up **only those two** — skip the `react`/`data` services (the `react`
service targets the old `client/`, and `client_v2` runs via Vite locally).

```sh
# from the repo root
docker compose up postgres django
```

Then, in another terminal:

```sh
cd client_v2
npm run dev          # Vite on :3000, proxies /api -> http://localhost:8000
```

`django` publishes `8000:8000` and `postgres` publishes on `5434`. The `django` service runs
`migrate` + `collectstatic` + `runserver` on start.

## Lightest reload: native Django via pipenv

If you'll also be touching backend code, run Django natively on the host (instant autoreload, no
container rebuild) against the dockerized Postgres:

```sh
docker compose up postgres            # just the database
cd server
pipenv install
pipenv run ./manage.py migrate
pipenv run ./manage.py runserver 8000
```

(Point it at the compose Postgres on `:5434` via the server's env/settings if it isn't already.)

## Vagrant: parity checks only, not the inner loop

Vagrant provisions a VM with the same Ansible playbooks as the production host, so it's the right
tool for an occasional "does this actually work on a prod-like box" check before a release. It is
heavyweight and prone to hangs, so it's a poor daily driver — prefer Docker Compose for the inner
loop and reach for Vagrant deliberately.

### When Vagrant hangs

The hangs are almost always VirtualBox holding a lock, not Vagrant itself. Recover in order:

```sh
vagrant halt --force
vagrant destroy --force

# if those hang, drop to VirtualBox directly:
VBoxManage list vms
VBoxManage controlvm <name> poweroff
VBoxManage unregistervm <name> --delete
```

A `vagrant destroy` stuck on "Forcing shutdown" is usually a stuck VM process —
`VBoxManage controlvm … poweroff` breaks it, then `destroy`/`unregistervm` completes. If even
`VBoxManage` hangs, kill the `VBoxHeadless` / `VirtualBoxVM` process for that VM and retry the
`unregistervm`.
