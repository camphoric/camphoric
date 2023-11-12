FROM python:3.11-alpine

ENV PYTHONUNBUFFERED 1

WORKDIR /app

COPY Pipfile .
COPY Pipfile.lock .

RUN apk add --no-cache --virtual build-deps gcc musl-dev postgresql-dev \
    openssl bash libffi-dev postgresql-client

RUN pip install pipenv \
    && pipenv install --dev --system \
    && rm -f Pipfile \
    && rm -f Pipfile.lock

COPY . .
RUN addgroup -S backend && adduser -S backend -G backend \
    && chown -R backend:backend .
USER backend
RUN mkdir -p frontend_bootstrap/build/static
# RUN ls -la && mkdir -p frontend_bootstrap/build/static && ./manage.py collectstatic --no-input
