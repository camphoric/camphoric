#!/bin/sh
# Notes on the events data/ installs from npm, as markdown on
# stdout (nothing when there's nothing to say); never fails:
# - an event whose latest published version is outside its range (a new
#   major, which npm update won't take)
# - an event repository in the camphoric org (camphoric-event-<name>, which
#   publishes @camphoric/camphoric-event-<name>) whose package the importer
#   doesn't install
# - an event repository whose "Camphoric releases" check (.github/workflows/
#   upstream.yml, doc/event-repo-ci.md) is missing or not active: GitHub
#   disables a scheduled workflow after 60 days without activity
#
# Run from data/:  scripts/latest-events-notes.sh   (uses gh for the org's repositories)
set -u

node scripts/registry-events.mjs | while read -r name range; do
  latest=$(npm view "$name" version 2>/dev/null)
  if [ -z "$latest" ]; then
    echo "- \`$name\`: couldn't look up its latest version"
  elif [ -z "$(node_modules/.bin/semver --include-prerelease -r "$range" "$latest")" ]; then
    echo "- \`$name\` $latest is published, outside the importer's \`$range\` (see \"What a spec version means\" in RELEASE.md for moving to a new major)"
  fi
done

# gh's error output, kept apart from what a lookup prints
err=$(mktemp)
trap 'rm -f "$err"' EXIT

# The org's event repositories (public ones, which every token can list)
if repos=$(gh api --paginate orgs/camphoric/repos --jq '.[] | select(.archived | not) | .name' 2>/dev/null); then
  installed=$(node -p "Object.keys(require('./package.json').dependencies).join('\n')")
  for repo in $repos; do
    case "$repo" in camphoric-event-*) ;; *) continue ;; esac
    if ! echo "$installed" | grep -qx "@camphoric/$repo"; then
      echo "- [camphoric/$repo](https://github.com/camphoric/$repo) is an event repository, but data/ doesn't install \`@camphoric/$repo\`: add it to data/package.json and EVENTS in data/eventModules.ts"
    fi
    upstream="https://github.com/camphoric/$repo/actions/workflows/upstream.yml"
    if state=$(gh api "repos/camphoric/$repo/actions/workflows/upstream.yml" --jq .state 2>"$err"); then
      if [ "$state" != active ]; then
        echo "- [camphoric/$repo]($upstream)'s \"Camphoric releases\" check (\`upstream.yml\`) is \`$state\`, so it doesn't test new Camphoric releases: enable it in that repository's Actions tab"
      fi
    elif grep -q 'HTTP 404' "$err"; then
      echo "- [camphoric/$repo](https://github.com/camphoric/$repo) has no \"Camphoric releases\" check (\`.github/workflows/upstream.yml\`), so nothing tests it against new Camphoric releases: copy it from another event repository (doc/event-repo-ci.md)"
    else
      echo "- couldn't look up [camphoric/$repo]($upstream)'s \"Camphoric releases\" check (\`upstream.yml\`)"
    fi
  done
else
  echo "- couldn't list the camphoric org's repositories, so event repositories data/ doesn't install weren't looked for"
fi
