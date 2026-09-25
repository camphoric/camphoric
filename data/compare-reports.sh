#!/bin/bash
# Compare one event's data/ reports with the legacy reports saved on the VM,
# with enriched data — a temporary tool for converting data/ reports (DR-41).
#
#   data/compare-reports.sh 4 harmony [--only 'Title'] [--show N]
#
# Scratch files go to server/tmp-reports/ (git-ignored).
set -e
id=$1; dir=$2; shift 2
args=$(printf ' %q' "$@")  # quoted for the VM's shell
tag="$id-$$"  # scratch files per run, so runs can go in parallel
cd "$(dirname "$0")/.."
mkdir -p server/tmp-reports
vagrant ssh -c "cd /vagrant/server && pipenv run python manage.py dump_report_api_data --event $id --enrich > tmp-reports/api-$tag.json 2>/dev/null"
(cd client_v2 && LADLE=1 npx vite-node scripts/legacy-report-outputs.mjs ../server/tmp-reports/api-$tag.json > ../server/tmp-reports/legacy-$tag.json 2>/dev/null)
node data/dump-reports.js "$dir" > server/tmp-reports/new-$tag.json
vagrant ssh -c "cd /vagrant/server && pipenv run python manage.py compare_report_templates --event $id --reports tmp-reports/new-$tag.json --legacy tmp-reports/legacy-$tag.json --enrich $args 2>&1 | grep -v 'environment variables'"
status=$?
rm -f server/tmp-reports/*-$tag.json
exit $status
