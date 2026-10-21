#!/bin/sh
# Run every event repository's e2e tests against a Camphoric image, such as a
# pre-release's, before it ships (doc/event-repo-ci.md, "Pre-releases"): starts
# e2e.yml in each of the camphoric org's camphoric-event-* repositories with
# that image_tag, and prints each run's link. Stable releases need none of
# this: each event repository's "Camphoric releases" check tests them.
#
# Uses your own gh login, which needs to be able to run those workflows.
#
# Run from anywhere:  data/scripts/test-event-repos.sh <image-tag>   (e.g. v0.15.0-rc.1)
set -u

if [ $# -ne 1 ] || [ -z "$1" ]; then
  echo "usage: $0 <image-tag>   (a tag of ghcr.io/camphoric/camphoric, e.g. v0.15.0-rc.1)" >&2
  exit 2
fi
tag=$1

all=$(gh api --paginate orgs/camphoric/repos --jq '.[] | select(.archived | not) | .name') || {
  echo "couldn't list the camphoric org's repositories" >&2
  exit 1
}
repos=$(echo "$all" | grep '^camphoric-event-' | sort)
if [ -z "$repos" ]; then
  echo "the camphoric org has no camphoric-event-* repositories" >&2
  exit 1
fi

failed=0
for repo in $repos; do
  # gh prints the new run's link
  if ! gh workflow run e2e.yml -R "camphoric/$repo" -f image_tag="$tag"; then
    echo "couldn't start camphoric/$repo's e2e run" >&2
    failed=1
  fi
done
exit $failed
