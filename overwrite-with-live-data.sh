#!/usr/bin/env bash
#
# Upload a PostgreSQL dump into the Vagrant VM and reset the app database to it,
# OVERWRITING ALL CURRENT DATA. Run from the repo root on the host.
#
#   ./restore-live-data.sh [dump-file]      # dump-file defaults to live-data.sql
#
# The dump is a plain `pg_dump` (as produced by `pg_dump camphoric > live-data.sql`).
# Objects in a live dump are owned by the `camphoric` role; the Vagrant database
# role is `vagrant`, so ownership is rewritten during restore. Everything the
# `vagrant` role owns is dropped first (DROP OWNED BY — the role owns the tables
# but not the `public` schema), so the dump restores into an empty schema.
#
set -euo pipefail

DUMP_FILE="${1:-live-data.sql}"
DB="camphoric"
DB_USER="vagrant"
REMOTE_DUMP="/tmp/camphoric-restore.sql"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$REPO_DIR/$DUMP_FILE"
if [ ! -f "$SRC" ]; then
  echo "Dump file not found: $SRC" >&2
  exit 1
fi

echo "==> Uploading $DUMP_FILE into the VM ($REMOTE_DUMP)"
vagrant upload "$SRC" "$REMOTE_DUMP"

echo "==> Resetting the '$DB' database (this overwrites all current data)"
vagrant ssh -c "bash -s -- '$REMOTE_DUMP' '$DB' '$DB_USER'" <<'REMOTE'
set -euo pipefail
DUMP="$1"; DB="$2"; DB_USER="$3"

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
  | psql -U "$DB_USER" -d "$DB" -v ON_ERROR_STOP=0 -q 2>/tmp/restore.err
non_benign=$(grep -i 'ERROR' /tmp/restore.err | grep -ivc 'does not exist' || true)
echo "  - restore errors (excluding benign 'does not exist'): ${non_benign:-0}"

echo "  - restored. Row counts:"
for t in event registration camper; do
  printf '      %-14s %s\n' "$t" "$(psql -U "$DB_USER" -d "$DB" -tAc "select count(*) from camphoric_$t")"
done

rm -f "$DUMP"
REMOTE

echo "==> Done. The database now holds the data from $DUMP_FILE."
echo "    (The dump's admin account is 'admin' / 'admin'.)"
