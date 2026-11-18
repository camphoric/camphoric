'''
List the registrations whose price would change on their next save (#805; SPEC
DR-167). A dry run: it prices each live registration in memory, as a save would
(as of its `completed_at`, else its `created_at`), and writes nothing.

    manage.py camphoric_price_check
    manage.py camphoric_price_check --event 4 --event 5

Each one is listed with its stored and repriced totals, what's been paid, and its
balance before and after; a balance below 0 means a refund would be due. It prices
with the code it's run from: to see what a release that changes pricing will do,
run it from that release against the live database (after its migrations, before
anyone edits a registration), so no total moves unnoticed on an unrelated edit.
'''

import json

from django.core.serializers.json import DjangoJSONEncoder
from django.core.management.base import BaseCommand

from camphoric import invoices, models, pricing


def stored_form(results):
    '''Pricing results as the JSON field gives them back (Decimals as strings, say).'''
    return json.loads(json.dumps(results, cls=DjangoJSONEncoder))


def repriced(registration):
    '''What a save would store as the registration's pricing results now.'''
    return stored_form(pricing.calculate_price(registration, registration.campers.all()))


class Command(BaseCommand):
    help = "List registrations whose price would change on their next save. Changes nothing."

    def add_arguments(self, parser):
        parser.add_argument('--event', type=int, action='append', default=[],
                            help='Only this event id (repeatable); every event by default.')

    def handle(self, *args, **options):
        registrations = (models.Registration.objects.select_related('event', 'promo_code')
                         .order_by('event_id', 'id'))
        if options['event']:
            registrations = registrations.filter(event_id__in=options['event'])

        changed = failed = 0
        for registration in registrations.iterator():
            where = (f'{registration.event.name} (#{registration.event_id}): registration '
                     f'#{registration.id}')
            try:
                line = self.change(registration)
            except Exception as error:  # e.g. a total that isn't a number: its save fails too
                failed += 1
                self.stdout.write(f'{where} couldn\'t be priced: {error!r}')
                continue
            if line:
                changed += 1
                self.stdout.write(f'{where} {line}')

        failures = f', {failed} couldn\'t be priced' if failed else ''
        self.stdout.write(
            f'{changed} registration(s) would be repriced on their next save{failures}. '
            'Nothing was changed.')

    @staticmethod
    def change(registration):
        '''What its next save would change, as a line of the report; None for nothing.'''
        now = repriced(registration)
        if now == stored_form(registration.server_pricing_results):
            return None
        ledger = invoices.ledger(registration)
        new_total = invoices.money(now.get('total'))
        new_balance = ledger.balance + new_total - ledger.price
        refund = '  (refund due)' if new_balance < 0 else ''
        return (f'{registration.registrant_email}: total {ledger.price} -> {new_total}, '
                f'paid {ledger.total_paid}, balance {ledger.balance} -> {new_balance}{refund}')
