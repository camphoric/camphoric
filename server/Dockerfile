FROM python:3.10-alpine

ENV PYTHONUNBUFFERED 1

WORKDIR /app

COPY Pipfile .
COPY Pipfile.lock .

RUN apk add --no-cache --virtual build-deps gcc musl-dev postgresql-dev openssl bash
RUN pip install pipenv \
    && pipenv install --system --dev --three \
    && rm -f Pipfile \
    && rm -f Pipfile.lock

COPY . .
RUN addgroup -S backend && adduser -S backend -G backend \
    && chown -R backend:backend .
USER backend

# RUN ls -la && mkdir -p frontend_bootstrap/build/static && ./manage.py collectstatic --no-input
