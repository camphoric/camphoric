# Server development

Camphoric Server is implemented using Django REST framework.

## Prerequisites

To get started, install the following prerequisites:

- Python 3 and pip
- pipenv
- PostgreSQL and libpq

### Installing prerequisites on MacOS

A newish version of MacOS is expected and so is [Homebrew](https://brew.sh/).
Install PostgreSQL:
```
brew install openssl postgresql
brew services start postgresql
```

Install Python 3 (this will take care of pip3) and pipenv with:
```
brew install python3 pipenv
```

Move to the following section: [Set up the Python environment](#set-up-the-python-environment).

### Installing prerequisites on Ubuntu 18.04

Install and start up PostgreSQL server:
```
sudo apt install postgresql libpq-dev
sudo service postgresql start
```

Ubuntu includes Python 3 by default.

Install pip:
```
sudo apt install python3-pip
```

Install pipenv:
```
pip3 install --user pipenv
```

## Set up the Python environment

MacOS: First, export these variables to prevent the following error:
`ld: library not found for -lssl`:
```
export LDFLAGS="-L/usr/local/opt/openssl/lib"
export CPPFLAGS="-I/usr/local/opt/openssl/include"
```

Install Python dependencies:
```
cd server
pipenv install --dev --three
```

From this point forward, it's assumed that this environment is active when
running python and manage.py commands. To activate it:
```
pipenv shell
```

## Set up the database

MacOS:
```
psql postgres
```

Ubuntu:
```
sudo -i -u postgres
psql
```

Then in psql in either system (get help with `\?`) run:
```
CREATE USER camphoric CREATEDB PASSWORD 'make-up-a-database-password-and-put-here';
CREATE DATABASE camphoric OWNER camphoric;
```
(Camphoric user is given the CREATEDB privilege for the purpose of creating test databases.)

Hit Ctrl-D to log out of psql (on Linux, also hit Ctrl-D to log out of the
postgres account).

## Configure Django

Create a file `server/camphoric_server/.env` with the following lines
```
DEBUG=on
SECRET_KEY=your-django-secret-key-here
DATABASE_URL=postgres://camphoric:your-database-password-here@127.0.0.1/camphoric
```
Fill in the database password, and fill in a value for `SECRET_KEY` from the
output of the following command:
```
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

## Run the tests

To test that the setup went correctly run
```
./manage.py test
```
from the server directory.

## Run the API development server

Before running the development server for the first time,
create the database tables and Django superuser:
```
cd server
./manage.py migrate
./manage.py createsuperuser
```
Follow onscreen instructions in the shell.

To run the Django development server, enter the following command from the
```
./manage.py runserver
```
To access the browsable API open this url in your browser:
```
http://127.0.0.1:8000/api/
```

## Authentication

There are two options now.
* Its possible to login to the browsable API by clicking on the login link at the top right corner of the page.

* Or using curl (and jq if you have it) you can interact with JSON API by requesting the token for your previously created user with:
	```
	curl -d username=<user name> -d password=<password> http://127.0.0.1:8000/api-token-auth/ | jq
	```
	If you want to request a resource that requires authentication run:
	```
	curl -H 'Authorization: Token <token>'
	```

# Client development

## Run the Client development server

From the client directory, install dependencies and run the client server using
[yarn](https://yarnpkg.com/lang/en/):

```
cd ./client/
yarn
yarn start
```

With both the API and Client developments servers running, you can access the
development version of Camphoric at this url: 

```
http://127.0.0.1:3000/
```

## Building for Production

In order to build the production version of Camphoric client, run `yarn build`
in the `client/` folder. This will build the prod version and copy the files
into the correct static directory in the `server/` for serving. After that,
running `python manage.py runserver` will serve the newly built frontend
from the appropriate bootstrap urls.
