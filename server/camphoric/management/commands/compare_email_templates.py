'''
Compare an event's saved email templates with candidate replacements
(SPEC §8.3, §8.4) — used to check Mustache emails converted to Jinja render
the same for every real registration and invitation.

    node data/dump-email-templates.js harmony > server/harmony-emails.json
    manage.py compare_email_templates --event 4 --templates harmony-emails.json

The templates file is JSON: `{confirmation: {engine, subject, template},
registration_types: [{name, engine, subject, template}]}`. Each email is
rendered both ways for every completed registration (confirmation) and every
invitation of the type, or an example one (invitation), then compared after
normalizing what the conversion is expected to change:

- HTML entities (Mustache escaped text emails; Jinja doesn't);
- dollar amounts (`$825.0`, `$1234.5` and `$1,234.50` compare equal);
- trailing spaces other than a markdown hard break, and runs of blank lines.

Prints a summary per email and a diff for the first few that differ; exits 1
if any differ.
'''

from decimal import Decimal, InvalidOperation
import difflib
import html
import json
import re

from django.core.management.base import BaseCommand, CommandError
from django.test import override_settings

from camphoric import models
from camphoric.templating.emails import (
    EmailTemplate, render_confirmation_email, render_invitation_email)
from camphoric.templating.graph import build_event_graph

MONEY = re.compile(r'(-?)\$\s?(-?)([\d,]*\.?\d+)')


def _money(match):
    sign = '-' if (match.group(1) or match.group(2)) else ''
    try:
        amount = Decimal(match.group(3).replace(',', ''))
    except InvalidOperation:
        return match.group(0)
    return f'{sign}${amount:,.2f}'


def normalize(text):
    text = MONEY.sub(_money, html.unescape(text or ''))
    lines = []
    for line in text.splitlines():
        stripped = line.rstrip()
        # Two or more trailing spaces are a markdown line break: keep one marker.
        lines.append(stripped + ('  ' if len(line) - len(stripped) >= 2 and stripped else ''))
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip()


def _template(data):
    return EmailTemplate(data.get('engine') or models.TemplateEngine.MUSTACHE,
                         data.get('subject') or '', data.get('template') or '')


class Command(BaseCommand):
    help = "Render an event's saved emails and candidate replacements, and compare them."

    def add_arguments(self, parser):
        parser.add_argument('--event', type=int, required=True)
        parser.add_argument('--templates', required=True, help='The candidate templates (JSON).')
        parser.add_argument('--show', type=int, default=3,
                            help='How many differing renders to print a diff for, per email.')

    def handle(self, *args, event, templates, show, **options):
        try:
            event_obj = models.Event.objects.get(id=event)
        except models.Event.DoesNotExist:
            raise CommandError(f'No event {event}.')
        with open(templates) as file:
            candidates = json.load(file)

        # Links need a base URL when there's no request; both sides get the same one.
        with override_settings(CAMPHORIC_PUBLIC_URL='https://camphoric.example'):
            differing = self.compare_all(event_obj, candidates, show)
        if differing:
            raise CommandError(f'{differing} email(s) render differently.')
        self.stdout.write(self.style.SUCCESS('All emails render the same.'))

    def compare_all(self, event, candidates, show):
        graph = build_event_graph(event)
        differing = 0
        if candidates.get('confirmation'):
            renders = [
                (f'registration #{r.id} ({r.registrant_email})',
                 lambda r=r, t=None: render_confirmation_email(r, template=t, graph=graph))
                for r in models.Registration.objects.filter(
                    event=event, completed=True, deleted_at__isnull=True).order_by('id')
            ]
            differing += self.compare('Confirmation email', _template(candidates['confirmation']),
                                      renders, show)

        types = {t.name: t for t in models.RegistrationType.objects.filter(
            event=event, deleted_at__isnull=True)}
        for candidate in candidates.get('registration_types') or []:
            registration_type = types.get(candidate['name'])
            if registration_type is None:
                self.stdout.write(f"  skip  invitation email {candidate['name']!r}: "
                                  'no such registration type')
                continue
            invitations = list(registration_type.invitation_set.filter(
                deleted_at__isnull=True).order_by('id')) or [models.Invitation(
                    registration_type=registration_type, recipient_name='Alex Sample',
                    recipient_email='alex@example.com', invitation_code='abcd2345')]
            renders = [
                (f'invitation to {i.recipient_email}',
                 lambda i=i, t=None: render_invitation_email(i, template=t, graph=graph))
                for i in invitations
            ]
            differing += self.compare(f"Invitation email {candidate['name']!r}",
                                      _template(candidate), renders, show)
        return differing

    def compare(self, title, candidate, renders, show):
        same, different, errors = 0, [], []
        for label, render in renders:
            saved = render()
            new = render(t=candidate)
            if not new.ok:
                errors.append((label, new.errors[0]))
                continue
            before = f'Subject: {saved.subject}\n\n{normalize(saved.text)}'
            after = f'Subject: {new.subject}\n\n{normalize(new.text)}'
            if before == after:
                same += 1
            else:
                different.append((label, before, after))

        status = 'ok  ' if not different and not errors else 'DIFF'
        self.stdout.write(f'{status}  {title}: {same} the same, {len(different)} different, '
                          f'{len(errors)} failed to render')
        for label, error in errors[:show]:
            where = f'{error.field} line {error.line}: ' if error.line else ''
            self.stdout.write(f'        {label}: {where}{error.message}')
        for label, before, after in different[:show]:
            self.stdout.write(f'  --- {label}')
            for line in difflib.unified_diff(before.splitlines(), after.splitlines(),
                                             'saved', 'candidate', lineterm='', n=1):
                self.stdout.write(f'      {line}')
        return int(bool(different or errors))
