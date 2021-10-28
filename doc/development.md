Server development
==================

Camphoric Server is implemented using Django REST framework.  This guide
assumes that you're running on a MacOS or Linux development machine.

Prerequisites
-------------

To get started, install the following prerequisites:

- [docker](https://docs.docker.com/get-docker/) - We recommend the docker desktop version for your environment.

For homebrew users: `brew cask install docker`

Setting up your containerized development servers
-------------------------------------------------

It is assumed that all of this is performed inside of the server dir, so:

```
cd server
```

### Creating and editing your server's .env files

First, copy the example .env files to use as a template:

```
cp -R .env.example .env
```

This will result in two .env files.

- .env/local/postgres
- .env/local/django

The only one you'll need to edit is '.env/local/django' file where it says
'your-django-secret-key-here'. You'll do this in the next step.

You can edit most of the other values in these files if you know what you're
doing, but it's probably best to just keep them the same for development.

### Creating a secret key for your Django server

First you'll need to build the web and db docker containers for the server:

```
docker-compose up --build -d
```

After this finishes, run `docker ps`. You should now see both your postgres and
web services running:

```
❯ docker ps
CONTAINER ID   IMAGE         COMMAND                  CREATED          STATUS                    PORTS                    NAMES
7fdca954842d   server_web    "bash -c './manage.p…"   20 seconds ago   Up 19 seconds             0.0.0.0:8000->8000/tcp   server_web_1
7cd4f71eaeb5   postgres:13   "docker-entrypoint.s…"   31 seconds ago   Up 30 seconds (healthy)   0.0.0.0:5434->5432/tcp   server_postgres_1
```

Run the following command to get your secret key:

```
docker-compose exec web python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

Copy the resulting secret key.  Open the '.env/local/django' file and replace
'your-django-secret-key-here' with the secret key created above.

### Running the server containers

Run the following to rebuild the database and django services:

```
docker-compose up --build -d
```

### Run the tests

To test that the setup went correctly run

```
docker-compose exec web bash -c "./manage.py test"
```

### Create the Django superuser

This user is the one that you'll use to log in with on the front end.  Run the
following and follow onscreen instructions in the shell:

```
docker-compose exec web bash -c "./manage.py createsuperuser"
```

### Load the sample data

Once your server is running, use the scripts in data directory to seed sample
data.

First, load the family week fixture data:

```
docker-compose exec web bash -c "./manage.py loaddata fixtures/familyweek-seed-data.json"
```

Second, load the Lark Camp sample data (when asked to log in, user your superuser
credentials):

```
cd ../data/lark; yarn; rm -f .auth-token; node loadData.mjs; cd -
```

### View loaded data

To access the browsable API open this url in your browser: [http://127.0.0.1:8000/api/](http://127.0.0.1:8000/api/)

You'll want to login using your superuser credentials to see all the data.

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
`docker-compose exec web bash -c "./manage.py test"` command.

It is recommended that you look at the existing tests in the 'server/tests/'
directory.  These should give you a good idea about what tests exist, and how
you might write new ones.

For information about writing tests in Django, see the [Django test docs](https://docs.djangoproject.com/en/3.2/topics/testing/overview/)
and the [Django REST api test docs](https://www.django-rest-framework.org/api-guide/testing/).

### Connecting to the database from the host

If you like using a database GUI tool like [Beekeeper Studio](https://www.beekeeperstudio.io/)
or [pgAdmin](https://www.pgadmin.org/), you can use the following to connect:

- The username, password, and database name is in 'server/.env/local/postgres'
- The server is exposed on port 5434

If using the env defaults, this should be [postgres://camphoric:camphoric@localhost:5434/camphoric](postgres://camphoric:camphoric@localhost:5434/camphoric)


Frontend Client development
===========================

Prerequisites
-------------

The frontend requires the backend - run through the [instructions for setting
up containerized development servers above](#server-development)

Setting up your containerized react server
------------------------------------------

It is assumed that all of this is performed inside of the client dir, so:

```
cd client
```

Then, you'll need to build the react service:

```
docker-compose up --build -d
```

After this finishes, run `docker ps`. You should now see your react service
running:

```
❯ docker ps
CONTAINER ID   IMAGE         COMMAND                  CREATED          STATUS        PORTS                    NAMES
182f11b452f4   client_react   "docker-entrypoint.s…"  31 seconds ago   Up 40 seconds 0.0.0.0:3000->3000/tcp   client_react_1
```

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
docker-compose file) you can use the `--no-deps` flag and specify the service
to rebuild a service individually.  Example of rebuilding only the web service:

```
(cd server; docker-compose up -d --no-deps --build web
```

Additional flags that may be handy here:

- --force-recreate - Recreate containers even if their configuration and image
  haven't changed.

### Running commands in a container

You can use the [docker-compose exec](https://docs.docker.com/compose/reference/exec/)
command to run arbitrary commands inside of a container:

- Open a shell in the web container: `(cd server; docker-compose exec web bash)`
- Run a command (like `ls`): `(cd server; docker-compose exec web ls -la)`
- Find out what yarn version we're running: `(cd client; docker-compose exec react yarn --version)`

### Seeing server log output

If you installed the Docker Desktop app, you can view the logs by going to:

```
Containers/Apps ➡ [compose dir] ➡ [container name]
```

Here you can view the logs, stats, environment variables, mount points, etc.

If you'd prefer to use the command line, you can use the [docker logs command](https://docs.docker.com/engine/reference/commandline/logs/).

```
(cd server; docker-compose logs -f web)
```
