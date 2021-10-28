FROM node:16-alpine
ENV PATH /app/node_modules/.bin:$PATH
WORKDIR /app
COPY . .
RUN apk add --no-cache --virtual build-deps python3 py3-pip make g++ \
    && yarn install
