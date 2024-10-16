FROM python:3.12-bookworm

RUN apt-get install -y --no-install-recommends gcc
RUN apt-get install -y --no-install-recommends bash
RUN apt-get install -y --no-install-recommends libffi-dev

# RUN apk add --no-cache --virtual \
#     .build-deps \
#     gcc \
#     musl-dev \
#     postgresql-dev \
#     openssl \
#     bash \
#     libffi-dev \
#     postgresql-client

WORKDIR /app

COPY Pipfile .
COPY Pipfile.lock .

RUN pip install --upgrade pip setuptools wheel
RUN pip install pipenv
RUN pip install --upgrade urllib3
# tvzny6zi825myjx2uxrzjzc9a
RUN pipenv install --dev --system
RUN rm -f Pipfile
RUN rm -f Pipfile.lock

COPY . .
RUN groupadd backend 
RUN useradd -g backend backend
RUN chown -R backend:backend .
USER backend
RUN mkdir -p frontend_bootstrap/build/static
RUN ls -la && mkdir -p frontend_bootstrap/build/static
