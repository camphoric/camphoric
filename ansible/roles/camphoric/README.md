# Camphoric role

Provisions the development VM with camphoric, from the code at `camphoric_folder`. It doesn't
clone or check out the repository, and it isn't a release deploy (see "Ansible" under "Deploying a
release" in [RELEASE.md](../../../RELEASE.md#ansible)).

- Installs a nginx config at `/etc/nginx/sites-available/camphoric`
- Installs a systemd service at `/etc/systemd/system/camphoric.service`
- Installs a socket listener for camphoric
- Builds `client/` from the code at `camphoric_folder` and installs the build

See the github repo for more info about the software: https://github.com/camphoric/camphoric

The gunicorn socket config is based on: https://www.digitalocean.com/community/tutorials/how-to-set-up-django-with-postgres-nginx-and-gunicorn-on-ubuntu-18-04

## Email

An app specific password should be set and created according to this:

https://support.google.com/mail/answer/185833

## Secrets

`defaults/main.yml` ships placeholder secrets, and `camphoric_environment: development`, so a
development VM provisions without a vault. Any other environment sets `camphoric_environment`
and overrides these in its inventory (the inventory file, `group_vars`), `host_vars`
(vault-encrypted, as in VM_DEV_SETUP.md) or `-e`:

- `camphoric_postgresql_password`
- `camphoric_django_secret_key`
- `camphoric_paypal_client_id`
- `camphoric_paypal_secret`
- `camphoric_django_superuser_password`

The role's first task fails, naming the variables, when any of these still holds its
placeholder (`this-should-be-…`, or `admin` for the superuser password) and
`camphoric_environment` is not `development`.

The playbook's `ansible/group_vars/all.yml` outranks variables in the inventory file and in
an inventory `group_vars/all.yml`, so it leaves `camphoric_environment` and these secrets to
the role's defaults. Keep them out of it.

## Logs

- `journalctl -u camphoric` - gunicorn service logs
- `journalctl -u nginx` - nginx logs
- `systemctl restart camphoric.service` restart camphoric (gunicorn)
