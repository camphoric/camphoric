# Server development

Camphoric Server is implemented using Django REST framework.

## Prerequisites

To get started, install the following prerequisites:

- Python 3 and pip
- virtualenv and virtualenvwrapper (recommended)
- PostgreSQL and libpq

### Installing prerequisites on MacOS

A newish version of MacOS is expected and so is [Homebrew](https://brew.sh/).
Install PostgreSQL:
```
brew install openssl postgresql
brew services start postgresql
```

Install Python 3 (this will take care of pip3) with:
```
brew install python3
```

Create a virtual environment for Camphoric with [virtualenvwrapper](https://virtualenvwrapper.readthedocs.io/en/latest/) (choose another if that makes you happy):
```
pip3 install virtualenvwrapper
```
Edit (or create) the file ~/.bashrc or add this to ~/.bash_profile, adding the following lines (if you add a ~/.bashrc don't forget to source it in your ~/bash_profile):
```
export VIRTUALENVWRAPPER_PYTHON=/usr/local/bin/python3
export WORKON_HOME=$HOME/.virtualenvs
source /usr/local/bin/virtualenvwrapper.sh
```
and finally: `source ~/.bash_profile`

Move to this section [Set up the virtual environment](#set-up-the-virtual-environment).

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

Install virtualenv and virtualenvwrapper:
```
pip3 install virtualenvwrapper
```

Add the following lines to `~/.bashrc`:
```
export VIRTUALENVWRAPPER_PYTHON=/usr/bin/python3
export VIRTUALENVWRAPPER_VIRTUALENV=$HOME/.local/bin/virtualenv
export WORKON_HOME=$HOME/.virtualenvs
source $HOME/.local/bin/virtualenvwrapper.sh
```

Then `source ~/.bashrc`.

[virtualenvwrapper documentation](https://virtualenvwrapper.readthedocs.io/en/latest/index.html)

## Set up the virtual environment

Create a new Python 3 virtual environment for camphoric:
```
cd PATH_TO/camphoric
mkvirtualenv -a . camphoric
```

The virtualenv is now active, which is indicated by `(camphoric)` at the
beginning of your shell prompt. To deactivate it, enter the command
`deactivate`. To activate it again later, enter the command `workon camphoric`.
(This will automatically `cd` you to the camphoric directory; if you don't want
that behavior, omit the `-a .` from the `mkvirtualenv` command). To delete this
virtualenv, `deactivate` it and then enter `rmvirtualenv camphoric`.

Install the dependencies into the virtualenv:
```
cd server
pip install -r requirements.txt
```
Note: On Mac if this fails with `ld: library not found for -lssl` export these variables and try again.
```
export LDFLAGS="-L/usr/local/opt/openssl/lib"
export CPPFLAGS="-I/usr/local/opt/openssl/include"
```

## Set up the Database
In the cmd line
for Linux run:
```
sudo -i -u postgres
psql
```
For MacOS run:
```
psql postgres
```
Then in psql in either system (get help with `\?`) run:
```
CREATE USER camphoric PASSWORD 'make-up-a-database-password-and-put-here';
CREATE DATABASE camphoric OWNER camphoric;
```

Hit Ctrl-D to log out of psql (on Linux, also hit Ctrl-D to log out of the
postgres account).

## Run the development server

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

Create the database tables and Django superuser:
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



[Django documentation](https://docs.djangoproject.com/en/2.2/)
