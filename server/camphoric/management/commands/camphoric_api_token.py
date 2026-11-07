'''
Make, list and revoke a user's personal access tokens on the server (SPEC §6,
DR-158), for scripts such as the importer:

    manage.py camphoric_api_token create <username> [--name NAME] [--expires 1h|7d|never]
                                                    [--read-only] [--replace]
    manage.py camphoric_api_token list <username>
    manage.py camphoric_api_token revoke <prefix or token>
    manage.py camphoric_api_token revoke --all <username>

`create` prints only the token, so a script can capture it:

    TOKEN=$(./manage.py camphoric_api_token create will --name import --expires 2h)

Everything else it says goes to stderr. `--expires` is a number and m, h, d or w
(1h by default), or `never`; CAMPHORIC_API_TOKEN_MAX_DAYS, when set, caps it.
`--replace` first revokes the user's other tokens of the same name, for a token
made afresh each time something starts. The audit log credits what this does
to the command and the account that ran it.
'''

import getpass

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from camphoric import api_tokens, audit, models


def _who_ran_it():
    try:
        return getpass.getuser()
    except (KeyError, OSError):
        # No name for the process's user (a container's arbitrary uid, say).
        return 'unknown'


def _when(value):
    return timezone.localtime(value).strftime('%Y-%m-%d %H:%M') if value else ''


class Command(BaseCommand):
    help = 'Make, list or revoke personal access tokens (API tokens for scripts).'

    def add_arguments(self, parser):
        actions = parser.add_subparsers(dest='action', required=True)

        create = actions.add_parser('create', help='Make a token and print it (only it).')
        create.add_argument('username')
        create.add_argument('--name', default='manage.py', help='What it\'s for (manage.py).')
        create.add_argument('--expires', default='1h',
                            help='How long it works: 30m, 2h, 7d, 4w, or never (1h).')
        create.add_argument('--read-only', action='store_true', help='It may only read.')
        create.add_argument('--replace', action='store_true',
                            help='First revoke the user\'s other tokens with this name.')

        list_ = actions.add_parser('list', help='List a user\'s tokens.')
        list_.add_argument('username')

        revoke = actions.add_parser('revoke', help='Revoke a token, or all of a user\'s.')
        revoke.add_argument('token', nargs='?', help='A token\'s prefix, or the token itself.')
        revoke.add_argument('--all', metavar='USERNAME', help='Revoke all of this user\'s tokens.')

    def handle(self, *args, action, **options):
        with audit.crediting_command(f'manage.py camphoric_api_token ({_who_ran_it()})'):
            getattr(self, f'handle_{action}')(**options)

    def user(self, username):
        try:
            return get_user_model().objects.get(username=username)
        except get_user_model().DoesNotExist:
            raise CommandError(f'There is no user {username!r}.')

    def handle_create(self, *, username, name, expires, read_only, replace, **options):
        user = self.user(username)
        name = name.strip()
        if not name or len(name) > 100:
            raise CommandError('Give the token a name of at most 100 characters.')
        try:
            lifetime = api_tokens.parse_duration(expires)
            expires_at = None if lifetime is None else timezone.now() + lifetime
            with transaction.atomic():
                replaced = api_tokens.revoke_all(user, name=name) if replace else 0
                token, key = api_tokens.issue(
                    user, name, expires_at, read_only=read_only,
                    via=models.ApiToken.VIA_COMMAND)
        except api_tokens.TokenError as error:
            raise CommandError(str(error))
        if replaced:
            self.stderr.write(f'Revoked {replaced} earlier token(s) named {name!r}.')
        self.stderr.write(
            f'Made {token.prefix}… for {username}'
            + (f', expiring {_when(token.expires_at)}' if token.expires_at else
               ', never expiring')
            + ('; read-only.' if read_only else '.'))
        self.stdout.write(key)

    def handle_list(self, *, username, **options):
        user = self.user(username)
        tokens = list(api_tokens.live(models.ApiToken.objects.filter(user=user)))
        if not tokens:
            self.stderr.write(f'{username} has no tokens.')
            return
        rows = [('PREFIX', 'NAME', 'MADE', 'EXPIRES', 'LAST USED', 'FROM', 'ACCESS')] + [
            (token.prefix, token.name, _when(token.created_at),
             _when(token.expires_at) or 'never', _when(token.last_used_at) or 'never',
             token.get_created_via_display(), 'read-only' if token.read_only else 'read-write')
            for token in tokens]
        widths = [max(len(row[i]) for row in rows) for i in range(len(rows[0]))]
        for row in rows:
            self.stdout.write('  '.join(cell.ljust(width) for cell, width in zip(row, widths))
                              .rstrip())

    def handle_revoke(self, *, token, all, **options):
        if bool(token) == bool(all):
            raise CommandError('Name a token (its prefix, or the token) or --all <username>.')
        if all:
            count = api_tokens.revoke_all(self.user(all))
            self.stderr.write(f'Revoked {count} token(s) of {all}.')
            return
        token = token.strip()
        if len(token) > api_tokens.SHOWN_LENGTH:
            found = models.ApiToken.objects.filter(key_hash=api_tokens.hash_key(token))
        else:
            found = models.ApiToken.objects.filter(prefix=token)
        found = list(found.select_related('user'))
        if not found:
            raise CommandError(f'No token matches {token!r}.')
        if len(found) > 1:
            raise CommandError(
                f'{len(found)} tokens start {token!r} '
                f'({", ".join(t.user.username for t in found)}): revoke it by the whole token.')
        api_tokens.revoke(found[0])
        self.stderr.write(f'Revoked {found[0].prefix}… of {found[0].user.username}.')
