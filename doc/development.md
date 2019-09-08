# Server development

## Prerequisites

Python 3 and pip are required. virtualenv and virtualenvwrapper are recommended
to create a self-contained Python environment for the server and its
dependencies. To set these up:

### Ubuntu 18.04

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

## Run the development server

To run the Django development server, enter the following command from the
`server` directory:
```
./manage.py runserver
```

[Django documentation](https://docs.djangoproject.com/en/2.2/)
