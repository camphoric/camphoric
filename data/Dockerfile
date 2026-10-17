# syntax=docker/dockerfile:1
FROM node:22-bookworm

# Now install the CRA
ENV PATH="/app/node_modules/.bin:${PATH}"
WORKDIR /app
RUN apt -y update && apt -y upgrade
RUN apt-get install -y --no-install-recommends python3
RUN apt-get install -y --no-install-recommends python3-pip
RUN apt-get install -y --no-install-recommends make
RUN apt-get install -y --no-install-recommends gcc
RUN apt-get install -y --no-install-recommends g++

COPY . .
RUN ls -la
# Events come from GitHub Packages, which needs a token even for public
# packages. It comes in as a build secret (docker-compose.yml's npm_token, from
# CAMPHORIC_NPM_AUTH_TOKEN) that's only in this step's environment, so it's in
# no layer: a config file on a tmpfs points npm at it. See README.md.
RUN --mount=type=secret,id=npm_token,env=CAMPHORIC_NPM_AUTH_TOKEN,required=false \
    --mount=type=tmpfs,target=/run/npm \
    if [ -z "$CAMPHORIC_NPM_AUTH_TOKEN" ]; then \
      echo 'data/ installs events from GitHub Packages, which needs a token with read:packages:' >&2; \
      echo '  CAMPHORIC_NPM_AUTH_TOKEN=$(gh auth token) docker compose build data   (see README.md)' >&2; \
      exit 1; \
    fi; \
    echo '//npm.pkg.github.com/:_authToken=${CAMPHORIC_NPM_AUTH_TOKEN}' > /run/npm/npmrc; \
    NPM_CONFIG_USERCONFIG=/run/npm/npmrc npm ci
RUN ln -s /app/import /usr/local/bin/
RUN mkdir -p node_modules/.cache && chmod -R 777 node_modules/.cache
