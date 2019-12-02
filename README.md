# Camphoric

Web-based Camp Registration System

## Getting Started

To run a local version of Camphoric, do the following:

### 1: Clone repository and install dependencies

* `git clone git@github.com:willfulbard/camphoric.git`
* `cd camphoric`
* `pip install -r server/requirements.txt`

### 2: Set up Postgres DB
Install Postgres onto your system. I don't have a recommened tutorial for this, but searching for installing postgres on your system should suffice.

Assuming you have postgres + the postgres cli set up on your system:
* `createdb camphoricdb`
* `psql camphoricdb`
* `CREATE USER camphoricuser;`
* `GRANT ALL PRIVILEGES ON DATABASE camphoricdb TO caomphoricuser;`

### 3: Set up Environment Variables:
* `cp server/camphoric_server/.env.sample server/camphoric_server/.env`
* In `.env`, replace `[secret]` with the result `python -c "import secrets; print(secrets.token_urlsafe(48))"`

### 4: Migrate the DB and run the server!
* `python server/manage.py migrate`
* `python server/manage.py runserver`

The server should now be running at `localhost:8000`!
