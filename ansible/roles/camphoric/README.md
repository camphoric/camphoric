# Camphoric role

Installs and configures camphoric.

- Installs a nginx config at `/etc/nginx/sites-available/camphoric`
- Installs a systemd service at `/etc/systemd/system/camphoric.service`
- Installs a socket listener for camphoric
- Installs code at `/home/{{ camphoric_user }}/camphoric/`

See the github repo for more info about the software: https://github.com/camphoric/camphoric

The gunicorn socket config is based on: https://www.digitalocean.com/community/tutorials/how-to-set-up-django-with-postgres-nginx-and-gunicorn-on-ubuntu-18-04

## Email

An app specific password should be set and created according to this:

https://support.google.com/mail/answer/185833

Inside the defaults/main.yml file there are lots of references to items that
should be in a vault.

## Logs

- `journalctl -u camphoric` - gunicorn service logs
- `journalctl -u nginx` - nginx logs
- `systemctl restart camphoric.service` restart camphoric (gunicorn)
