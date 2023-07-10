FROM node:18-alpine
RUN apk add --no-cache --virtual build-deps python3 py3-pip make g++
WORKDIR /frontend
COPY client/ .
RUN npm cache clear --force; \
    npm ci; \
    npm run build


FROM python:alpine

ENV PYTHONUNBUFFERED 1

WORKDIR /app

RUN apk add --no-cache --virtual build-deps gcc musl-dev postgresql-dev \
    openssl bash libffi-dev postgresql-client

# for layer caching reasons, we copy only Pipfile* and pipenv install before we
# copy the rest.  This means if we make quick file changes and want to rebuild,
# it'll be pretty quick.

COPY server/Pipfile .
COPY server/Pipfile.lock .

RUN    pip install pipenv \
    && pipenv install --dev --system \
    && rm -f Pipfile \
    && rm -f Pipfile.lock

ENV DJANGO_SETTINGS_MODULE=camphoric_server.settings
COPY server/ .
COPY --from=0 /frontend/build /app/frontend_bootstrap/build

RUN    addgroup -S backend \
    && adduser -S backend -G backend \
    && chown -R backend:backend .
USER backend


CMD ["/bin/sh", "-c", " \
  ./manage.py createstaticdirs && \
  ./manage.py migrate && \
  ./manage.py collectstatic --no-input && \
  ./manage.py runserver 0.0.0.0:9000 \
"]
