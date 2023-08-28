FROM node:alpine

ENV PATH="/app/node_modules/.bin:${PATH}"
WORKDIR /app
RUN apk add --no-cache --virtual build-deps python3 py3-pip make g++

COPY package.json /app/
COPY package-lock.json /app/
RUN npm cache clear --force --loglevel verbose
RUN npm ci --loglevel verbose

COPY . .
RUN ln -s /app/import /usr/local/bin/
RUN mkdir -p node_modules/.cache && chmod -R 777 node_modules/.cache
