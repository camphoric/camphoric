#!/usr/bin/env bash
#
# Upload a PostgreSQL dump into the Vagrant VM and reset the app database to it,
# OVERWRITING ALL CURRENT DATA. Run from the repo root on the host.
#
#   ./overwrite-with-live-data.sh [dump-file]      # dump-file defaults to live-data.sql
#
# The dump is a plain `pg_dump` (as produced by `pg_dump camphoric > live-data.sql`).
# Objects in a live dump are owned by the `camphoric` role; the Vagrant database
# role is `vagrant`, so ownership is rewritten during restore. Everything the
# `vagrant` role owns is dropped first (DROP OWNED BY — the role owns the tables
# but not the `public` schema), so the dump restores into an empty schema.
#
# A live dump holds the organization's email accounts (with their passwords) and
# any email still waiting to go out, so the restore must not let the VM email real
# people: the email worker is stopped before restoring, every restored email
# account is switched to the console backend (messages go to the worker's log),
# and queued messages are marked failed. The worker is started again only once
# all of that has succeeded.
#
# The dump, and the restore's error log, are removed from the VM however the
# script ends. It exits non-zero if the restore reported errors.
#
set -euo pipefail

DUMP_FILE="${1:-live-data.sql}"
DB="camphoric"
DB_USER="vagrant"
REMOTE_DUMP="/tmp/camphoric-restore.sql"
REMOTE_ERR="/tmp/restore.err"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$REPO_DIR/$DUMP_FILE"
if [ ! -f "$SRC" ]; then
  echo "Dump file not found: $SRC" >&2
  exit 1
fi

# The VM-side script cleans up after itself; this covers the VM never running it
# (e.g. `vagrant ssh` failed, or the script was interrupted here).
uploaded=""
cleanup_vm() {
  local status=$?
  if [ -n "$uploaded" ] && [ "$status" -ne 0 ]; then
    echo "==> Removing the dump from the VM" >&2
    vagrant ssh -c "rm -f '$REMOTE_DUMP' '$REMOTE_ERR'" </dev/null >/dev/null 2>&1 \
      || echo "    Couldn't; remove $REMOTE_DUMP from the VM by hand." >&2
  fi
  exit "$status"
}
trap cleanup_vm EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "==> Uploading $DUMP_FILE into the VM ($REMOTE_DUMP)"
uploaded=1
vagrant upload "$SRC" "$REMOTE_DUMP"

echo "==> Resetting the '$DB' database (this overwrites all current data)"
vagrant ssh -c "bash -s -- '$REMOTE_DUMP' '$DB' '$DB_USER' '$REMOTE_ERR'" <<'REMOTE'
set -euo pipefail
DUMP="$1"; DB="$2"; DB_USER="$3"; ERR="$4"
WORKER="camphoric-worker"

cleanup() {
  local status=$?
  rm -f "$DUMP" "$ERR"
  if [ "$status" -ne 0 ] && [ -n "${worker_stopped:-}" ]; then
    echo "  - $WORKER left stopped; start it once the database is right:" >&2
    echo "      sudo systemctl start $WORKER" >&2
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

worker_stopped=""
if systemctl cat "$WORKER.service" >/dev/null 2>&1; then
  echo "  - stopping $WORKER (so it can't send the restored email)"
  sudo systemctl stop "$WORKER"
  worker_stopped=1
fi

echo "  - terminating other connections to $DB"
psql -U "$DB_USER" -d postgres -tAc \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB' AND pid <> pg_backend_pid()" \
  >/dev/null 2>&1 || true

echo "  - dropping everything owned by $DB_USER"
psql -U "$DB_USER" -d "$DB" -v ON_ERROR_STOP=1 -q -c "DROP OWNED BY $DB_USER CASCADE;"

echo "  - restoring the dump (ownership camphoric -> $DB_USER)"
# The dump's own leading DROPs now hit an empty schema (benign "does not exist");
# CREATE/COPY then apply cleanly, so ON_ERROR_STOP=0 tolerates only those.
sed 's/OWNER TO camphoric/OWNER TO '"$DB_USER"'/g' "$DUMP" \
  | psql -U "$DB_USER" -d "$DB" -v ON_ERROR_STOP=0 -q 2>"$ERR"
non_benign=$(grep -i 'ERROR' "$ERR" | grep -ivc 'does not exist' || true)
non_benign=${non_benign:-0}
echo "  - restore errors (excluding benign 'does not exist'): $non_benign"

# Keep the VM from emailing anyone in the dump: send as every restored account
# through the console backend, and fail what was waiting to go out. A dump from
# before these tables existed skips them.
echo "  - switching email accounts to the console backend; failing queued email"
psql -U "$DB_USER" -d "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$
BEGIN
  IF to_regclass('public.camphoric_emailaccount') IS NOT NULL THEN
    UPDATE camphoric_emailaccount
       SET backend = 'django.core.mail.backends.console.EmailBackend';
  END IF;
  IF to_regclass('public.camphoric_emailmessage') IS NOT NULL THEN
    UPDATE camphoric_emailmessage
       SET status = 'failed', lease_until = NULL,
           last_error = 'Not sent: restored into a development VM.'
     WHERE status IN ('queued', 'sending');
  END IF;
END
$$;
SQL

echo "  - restored. Row counts:"
for t in event registration camper; do
  printf '      %-14s %s\n' "$t" "$(psql -U "$DB_USER" -d "$DB" -tAc "select count(*) from camphoric_$t")"
done

if [ "$non_benign" -gt 0 ]; then
  echo "  - the restore is incomplete. Its errors:" >&2
  grep -i 'ERROR' "$ERR" | grep -iv 'does not exist' | head -n 20 | sed 's/^/      /' >&2
  exit 1
fi

if [ -n "$worker_stopped" ]; then
  echo "  - starting $WORKER"
  sudo systemctl start "$WORKER"
fi
REMOTE

echo "==> Done. The database now holds the data from $DUMP_FILE."
echo "    Its email accounts send to the worker's log (journalctl -u camphoric-worker);"
echo "    switch one back to SMTP in the admin only if you mean to send real email."
echo "    Sign in with an account from the dump; the restore doesn't set any passwords."
