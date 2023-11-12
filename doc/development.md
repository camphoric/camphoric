Camphoric is implemented using the Django REST framework, postgres, and
Create React App.  This guide assumes that you're running on a MacOS or Linux
development machine.

Prerequisites
=============

To get started, install [docker](https://docs.docker.com/get-docker/). We
recommend the docker desktop version for your environment.

For homebrew users: `brew cask install docker;`

Using the development setup wizard
==================================

We have a setup wizard which will guide you through the process of setting up
the docker containers and services.  If you'd rather do it manually because
you like to learn by doing or you don't like installing unnecessary
dependencies, just [skip to the next section.](#setting-up-your-containerized-development-servers)

Install the following:

- [node](https://nodejs.org/en/download/)

For homebrew users: `brew install node`

Run the following and follow the prompts:

```
npm install; ./development-setup-wizard.mjs
```

Creating the docker services (the hard way)
===========================================

Keep reading if you want do set up all the docker containers yourself.  You'll
learn a lot about docker!

Setting up your containerized development servers
-------------------------------------------------

### Creating and editing your server's env files

First, copy the example env files to use as a template:

```
cp -R .env.example env
```

This will result in these env files.

- env/local/django.env
- env/local/postgres.env
- env/local/react.env

The only one you'll need to edit is 'env/local/django' file where it says
'your-django-secret-key-here'. You'll do this in the next step.

You can edit most of the other values in these files if you know what you're
doing, but it's probably best to just keep them the same for development.

### Creating a secret key for your Django server

First you'll need to build the web and db docker containers for the server:

```
docker-compose up --build -d
```

After this finishes, run `docker ps`. You should now see both your postgres,
django and react services running:

```
❯ docker ps
CONTAINER ID   IMAGE              COMMAND                  CREATED              STATUS                    PORTS                    NAMES
c3fc38546a07   camphoric_react    "docker-entrypoint.s…"   About a minute ago   Up 1 minute (healthy)     0.0.0.0:3000->3000/tcp   camphoric_react_1
feba46e79c59   camphoric_django   "bash -c './manage.p…"   2 minutes ago        Up 2 minutes (healthy)    0.0.0.0:8000->8000/tcp   camphoric_django_1
9a600e45e1ce   postgres:13        "docker-entrypoint.s…"   15 minutes ago       Up 15 minutes (healthy)   0.0.0.0:5434->5432/tcp   camphoric_postgres_1
```

Run the following command to get your secret key:

```
docker-compose exec django python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

Copy the resulting secret key.  Open the 'env/local/django' file and replace
'your-django-secret-key-here' with the secret key created above.  You'll likely
want to put it in quotes since it sometimes has special characters that break
things.

### Running the server containers

Run the following to rebuild the django services with your new key:

```
docker-compose up -d --force-recreate --no-deps --build django
```

### Run the tests

To test that the setup went correctly run:

```
docker-compose exec django python manage.py test
```

### Create the Django superuser

This user is the one that you'll use to log in with on the front end.  Run the
following and follow onscreen instructions in the shell:

```
docker-compose exec django bash -c "./manage.py createsuperuser"
```

### Load the sample data

Once your server is running, use the scripts in data directory to seed sample
data.

First, load the family week fixture data:

```
docker-compose exec django bash -c "./manage.py loaddata fixtures/familyweek-seed-data.json"
```

Second, load the Lark Camp sample data (when asked to log in, user your superuser
credentials):

```
docker-compose exec react node fixtures/lark/loadData.mjs
```

### View loaded data

To access the browsable API open this url in your browser: [http://127.0.0.1:8000/api/](http://127.0.0.1:8000/api/)

You'll want to login using your superuser credentials to see all the data.

### View the app

Go to [http://localhost:3000/](http://localhost:3000/)

Frontend development process
----------------------------

The frontend was created using [CRA](https://create-react-app.dev/), and will
automatically reload when it detects edits.  The react server is running the
[development server](https://create-react-app.dev/docs/available-scripts#npm-start).
It doesn’t handle backend logic or databases; it just creates a frontend build
pipeline.  Under the hood, it uses Babel and webpack, but you don’t need to
know anything about them.

If for some reason you need to restart the service you can run this command:

```
docker-compose restart react
```

If you need to do a full rebuild of the container, you can do this:

```
docker-compose up -d --no-deps --build react
```

Server development process
--------------------------

The Django server will automatically reload when you change any .py files.

### First step: rebuilding and starting the server containers

Run the following to rebuild the database and django containers:

```
docker-compose up --build -d
```

You'll want to do this every time when you start development.

Note:

- This won't delete any of the existing database files.

### Writing tests

It is recommended that you write tests. All tests are run when you run the
`docker-compose exec django python manage.py test` command.

It is recommended that you look at the existing tests in the 'server/tests/'
directory.  These should give you a good idea about what tests exist, and how
you might write new ones.

For information about writing tests in Django, see the [Django test docs](https://docs.djangoproject.com/en/3.2/topics/testing/overview/)
and the [Django REST api test docs](https://www.django-rest-framework.org/api-guide/testing/).

### Database migrations

To make changes to the models (database schema), e.g. to add a model field
(database column), refer to the [Django documentation on
migrations](https://docs.djangoproject.com/en/3.2/topics/migrations/). There are
a few differences due to the Docker setup. The `manage.py makemigrations`
command may fail with "Permission denied" unless you (temporarily) loosen the
permissions on the migations directory. Here's the sequence of commands you
might use after editing models.py:

    chmod 777 server/camphoric/migrations
    docker-compose exec django python manage.py makemigrations
    chmod 755 server/camphoric/migrations
    docker-compose exec django python manage.py migrate

### Connecting to the database from the host

If you like using a database GUI tool like [Beekeeper Studio](https://www.beekeeperstudio.io/)
or [pgAdmin](https://www.pgadmin.org/), you can use the following to connect:

- The username, password, and database name is in 'env/local/postgres'
- The server is exposed on port 5434

If using the env defaults, this should be [postgres://camphoric:camphoric@localhost:5434/camphoric](postgres://camphoric:camphoric@localhost:5434/camphoric)

Tips for working with docker
============================

Official docs
-------------

- [docker official documentation home](https://docs.docker.com/)
- [docker cli](https://docs.docker.com/engine/reference/commandline/cli/)
- [docker-compose cli](https://docs.docker.com/compose/reference/)

Helpful Hints and How-Tos
-------------------------

### Detached vs non-detached

When running `docker-compose up --build -d`, the -d means run it "detached", or
in the background.  This means that you'll not see any logging output in your
terminal, but see the section on log output below on how to view it.  If you
would rather just see the output continuously, just run this command without
the -d.

### Rebuilding only one service

If you need to just rebuild one service (ex you're iterating on the
docker-compose file or the client/package.json) you can use the `--no-deps`
flag and specify the service to rebuild a service individually.  Example of
rebuilding only the web service:

```
docker-compose up -d --no-deps --build react
```

Additional flags that may be handy here:

- --force-recreate - Recreate containers even if their configuration and image
  haven't changed.

### Running commands in a container

You can use the [docker-compose exec](https://docs.docker.com/compose/reference/exec/)
command to run arbitrary commands inside of a container:

- Open a shell in the web container: `docker-compose exec django bash`
- Run a command (like `ls`): `docker-compose exec django ls -la`
- Find out what npm version we're running: `docker-compose exec react npm --version`
- Install a new npm package for the client: `docker-compose exec react npm install <pkgname>`

### Seeing server log output

If you installed the Docker Desktop app, you can view the logs by going to:

```
Containers/Apps ➡ [compose dir] ➡ [container name]
```

Here you can view the logs, stats, environment variables, mount points, etc.

If you'd prefer to use the command line, you can use the [docker logs command](https://docs.docker.com/engine/reference/commandline/logs/).

```
docker-compose logs -f django
```

### Container/image/volume removal

**Delete all containers**

If you want to PERMENANTLY delete images, volumes, and containers associated
with camphoric:

```
./remove-all-docker-artifacts
```

use `./remove-all-docker-artifacts -h` for more details

**Delete unused artifacts**

If you just want to clean up some hard drive space:

```
./remove-unused-docker-artifacts
```

use `./remove-unused-docker-artifacts -h` for more details
