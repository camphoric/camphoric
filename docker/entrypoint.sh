#!/bin/sh
# Container entrypoint: run migrations (with a retry while the database comes up),
# optionally bootstrap a superuser, then exec the CMD (gunicorn, or the task worker
# with CAMPHORIC_SKIP_MIGRATE=1). See CONTAINER.md.
set -eu
cd /app

if [ "${CAMPHORIC_SKIP_MIGRATE:-0}" != "1" ]; then
  # Retry so a plain `docker run` without a healthy-database gate still comes up.
  n=0
  until python manage.py migrate --no-input; do
    n=$((n + 1))
    if [ "$n" -ge 10 ]; then
      echo "migrate failed after $n attempts" >&2
      exit 1
    fi
    echo "database not ready, retrying in 3s ($n/10)"
    sleep 3
  done
fi

# Opt-in, idempotent superuser bootstrap (used by CI and for a first boot).
if [ -n "${DJANGO_SUPERUSER_USERNAME:-}" ] && [ -n "${DJANGO_SUPERUSER_PASSWORD:-}" ]; then
  python manage.py shell -c "
from django.contrib.auth import get_user_model
import os
User = get_user_model()
username = os.environ['DJANGO_SUPERUSER_USERNAME']
if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(
        username,
        os.environ.get('DJANGO_SUPERUSER_EMAIL', ''),
        os.environ['DJANGO_SUPERUSER_PASSWORD'],
    )
print('superuser ok:', username)
"
fi

exec "$@"
