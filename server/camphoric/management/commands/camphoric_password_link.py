'''
Give someone a password without the admin's Users screen or working email (SPEC DR-52):

    manage.py camphoric_password_link <username>                  # print a set-password link
    manage.py camphoric_password_link <username> --send           # ...and email it
    manage.py camphoric_password_link <username> --base-url https://reg.example.org
    manage.py camphoric_password_link <username> --set [--require-change]  # type a password

Links point at CAMPHORIC_PUBLIC_URL unless --base-url is given.
'''

import getpass

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from camphoric import accounts
from camphoric.serializers import password_problems


class Command(BaseCommand):
    help = 'Print (or email) a set-password link for a user, or set their password.'

    def add_arguments(self, parser):
        parser.add_argument('username')
        parser.add_argument('--send', action='store_true', help='Also email the link.')
        parser.add_argument('--base-url', help='The site address links start with.')
        parser.add_argument('--set', action='store_true',
                            help='Type a password to set instead of making a link.')
        parser.add_argument('--require-change', action='store_true',
                            help='With --set: they must change it at their next sign-in.')

    def handle(self, *, username, send, base_url, set, require_change, **options):
        try:
            user = get_user_model().objects.get(username=username)
        except get_user_model().DoesNotExist:
            raise CommandError(f'There is no user {username!r}.')
        if not user.is_active:
            raise CommandError(f'{username} is deactivated.')

        if set:
            password = getpass.getpass('New password: ')
            if password != getpass.getpass('Again: '):
                raise CommandError('The passwords don\'t match.')
            problems = password_problems(password, user)
            if problems:
                raise CommandError(' '.join(problems))
            accounts.set_password(user, password, must_change=require_change)
            self.stdout.write(f'Password set for {username}'
                              + (' (to be changed at their next sign-in).' if require_change
                                 else '.'))
            return

        url = accounts.password_link(user, base=base_url)
        if not url:
            raise CommandError('There is no site address; set CAMPHORIC_PUBLIC_URL or pass '
                               '--base-url.')
        self.stdout.write(url)
        if send:
            try:
                message = accounts.send_password_link(user, base=base_url)
            except accounts.AccountError as error:
                raise CommandError(str(error))
            self.stdout.write(f'Emailed to {message.to} ({message.status}).')
