# Backups

When running the basic backup command in development / docker containers, by
default the backups are setup to land here.

For more information, see:

https://django-dbbackup.readthedocs.io/en/master/index.html

## Basic backup commands

- create basic db backup: `docker compose exec django python manage.py dbbackup`
- list db backups: `docker compose exec django python manage.py listbackups`
- restore from latest backup: `docker compose exec django python manage.py dbrestore`
