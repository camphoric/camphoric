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

## Secrets

`defaults/main.yml` (and `ansible/group_vars/all.yml`) ship placeholder secrets so a
development VM provisions without a vault. Any other `camphoric_environment` must override
them, and `camphoric_environment` itself, somewhere that outranks the playbook's
`group_vars/all.yml`: `host_vars/<host>.yml` (vault-encrypted, as in VM_DEV_SETUP.md), an
inventory `group_vars/<group>.yml` file, or `-e`. Variables in the inventory file itself
(`[all:vars]`, `[<group>:vars]`) or in an inventory `group_vars/all.yml` lose to it and are
silently ignored.

- `camphoric_postgresql_password`
- `camphoric_django_secret_key`
- `camphoric_paypal_client_id`
- `camphoric_paypal_secret`
- `camphoric_django_superuser_password`

The role's first task fails, naming the variables, when any of these still holds its
placeholder (`this-should-be-…`, or `admin` for the superuser password) and
`camphoric_environment` is not `development`.

## Logs

- `journalctl -u camphoric` - gunicorn service logs
- `journalctl -u nginx` - nginx logs
- `systemctl restart camphoric.service` restart camphoric (gunicorn)
