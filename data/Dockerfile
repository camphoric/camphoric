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
# A token for GitHub Packages, when one is given, comes in as a build secret
# (docker-compose.yml's npm_token, from CAMPHORIC_NPM_AUTH_TOKEN) that's only in
# this step's environment, so it's in no layer: a config file on a tmpfs points
# npm at it. Without one, the install works as long as nothing comes from the
# registry. See README.md.
RUN --mount=type=secret,id=npm_token,env=CAMPHORIC_NPM_AUTH_TOKEN,required=false \
    --mount=type=tmpfs,target=/run/npm \
    if [ -n "$CAMPHORIC_NPM_AUTH_TOKEN" ]; then \
      echo '//npm.pkg.github.com/:_authToken=${CAMPHORIC_NPM_AUTH_TOKEN}' > /run/npm/npmrc; \
      export NPM_CONFIG_USERCONFIG=/run/npm/npmrc; \
    fi; \
    npm ci
RUN ln -s /app/import /usr/local/bin/
RUN mkdir -p node_modules/.cache && chmod -R 777 node_modules/.cache
