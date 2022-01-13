FROM node:16-alpine

# https://github.com/Zenika/alpine-chrome/blob/master/Dockerfile
# Installs latest Chromium package.
RUN printf "http://dl-cdn.alpinelinux.org/alpine/edge/main\nhttp://dl-cdn.alpinelinux.org/alpine/edge/community\nhttp://dl-cdn.alpinelinux.org/alpine/edge/testing\nhttp://dl-cdn.alpinelinux.org/alpine/v3.12/main" >> /etc/apk/repositories
RUN apk upgrade -U -a && apk add libstdc++ chromium harfbuzz nss freetype ttf-freefont font-noto-emoji wqy-zenhei
RUN rm -rf /var/cache/* && mkdir /var/cache/apk

COPY ./tests-e2e/etc/fonts/local.conf /etc/fonts/local.conf

RUN mkdir -p /usr/src/app && chown -R node:node /usr/src/app

ENV CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/lib/chromium/

# Autorun chrome headless
# ENTRYPOINT ["chromium-browser", "--headless", "--use-gl=swiftshader", "--disable-software-rasterizer", "--disable-dev-shm-usage"]

# Now install the CRA
ENV PATH="/app/node_modules/.bin:${PATH}"
WORKDIR /app
RUN apk add --no-cache --virtual build-deps python3 py3-pip make g++

COPY . .
RUN ls -la
RUN yarn install --frozen-lockfile
