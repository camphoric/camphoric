'''
Migration 0076: existing payments become invoices, with every balance
unchanged (SPEC DR-92); and back again.
'''

from contextlib import redirect_stdout
from decimal import Decimal
from io import StringIO

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

D = Decimal
BEFORE = [('camphoric', '0074_promo_codes')]
AFTER = [('camphoric', '0077_payments_need_invoices')]


def paypal_details(order_id, capture_id, value):
    return {'id': order_id, 'status': 'COMPLETED', 'payer': {'email_address': 'p@example.com'},
            'purchase_units': [{'amount': {'value': value, 'currency_code': 'USD'},
                                'payments': {'captures': [{'id': capture_id}]}}]}


class InvoiceMigrationTests(TransactionTestCase):
    def setUp(self):
        self.executor = MigrationExecutor(connection)
        self.executor.migrate(BEFORE)
        apps = self.executor.loader.project_state(BEFORE).apps
        self.Registration = apps.get_model('camphoric', 'Registration')
        self.Payment = apps.get_model('camphoric', 'Payment')
        self.PricingOverride = apps.get_model('camphoric', 'PricingOverride')
        Organization = apps.get_model('camphoric', 'Organization')
        Event = apps.get_model('camphoric', 'Event')
        self.event = Event.objects.create(
            organization=Organization.objects.create(name='Org'), name='Old Camp',
            epayment_handling=D('2.5'))

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())

    def registration(self, total, handling=None, **fields):
        results = {'total': total, 'campers': []}
        if handling is not None:
            results['handling'] = handling
        return self.Registration.objects.create(
            event=self.event, registrant_email='p@example.com', server_pricing_results=results,
            **fields)

    def migrate(self, target):
        executor = MigrationExecutor(connection)
        output = StringIO()
        with redirect_stdout(output):
            executor.migrate(target)
        self.output = output.getvalue()
        return executor.loader.project_state(target).apps

    def balance(self, apps, registration_id):
        from camphoric import invoices
        Registration = apps.get_model('camphoric', 'Registration')
        Invoice = apps.get_model('camphoric', 'Invoice')
        Payment = apps.get_model('camphoric', 'Payment')
        registration = Registration.objects.get(pk=registration_id)
        price = invoices.money(registration.server_pricing_results.get('total'))
        handling = sum((i.handling for i in Invoice.objects.filter(
            registration=registration, cancelled_at__isnull=True)), D('0'))
        paid = sum((p.amount for p in Payment.objects.filter(
            registration=registration, deleted_at__isnull=True)), D('0'))
        return price + handling - paid

    def test_every_case_keeps_its_balance(self):
        cases = {}
        # A check deposit, and its check.
        r = self.registration(300, completed=True, payment_type='Check',
                              initial_payment={'type': '50% Deposit', 'total': 150})
        self.Payment.objects.create(registration=r, amount=D('150'), payment_type='Check')
        cases['check'] = (r.id, D('150.00'))
        # A check deposit, no check yet.
        r = self.registration(300, completed=True, payment_type='Check',
                              initial_payment={'type': '50% Deposit', 'total': 150})
        cases['check_unpaid'] = (r.id, D('300.00'))
        # PayPal in full, with the fee kept by an override.
        r = self.registration(307.5, 7.5, completed=True, payment_type='PayPal',
                              initial_payment={'type': 'Full', 'total': 307.5},
                              paypal_response={'id': 'ORDER-A'})
        self.Payment.objects.create(registration=r, amount=D('307.50'), payment_type='PayPal',
                                    paypal_order_details=paypal_details('ORDER-A', 'CAP-A',
                                                                        '307.50'))
        self.PricingOverride.objects.create(registration=r, var='handling', amount=D('7.50'),
                                            reason='Kept at the amount when paid online')
        cases['paypal'] = (r.id, D('0.00'))
        # A PayPal deposit (Lark: the whole fee on the deposit).
        r = self.registration(1025, 25, completed=True, payment_type='Card',
                              initial_payment={'type': '50% Deposit', 'total': 575},
                              paypal_response={'id': 'ORDER-B'})
        self.Payment.objects.create(registration=r, amount=D('575'), payment_type='Card',
                                    paypal_order_details=paypal_details('ORDER-B', 'CAP-B',
                                                                        '575.00'))
        cases['deposit'] = (r.id, D('450.00'))
        # PayPal whose verification failed back then: no payment recorded.
        r = self.registration(307.5, 7.5, completed=True, payment_type='PayPal',
                              initial_payment={'type': 'Full', 'total': 307.5},
                              paypal_response={'id': 'ORDER-C'})
        cases['unverified'] = (r.id, D('307.50'))
        # Nothing to pay.
        r = self.registration(0, completed=True, payment_type='Check',
                              initial_payment={'type': 'none', 'total': 0})
        cases['free'] = (r.id, D('0.00'))
        # A voucher recorded by a registrar, and a deleted payment.
        r = self.registration(300, completed=True, payment_type='Check',
                              initial_payment={'type': 'Full', 'total': 300})
        self.Payment.objects.create(registration=r, amount=D('300'), payment_type='Check')
        self.Payment.objects.create(registration=r, amount=D('20'), payment_type='Voucher')
        self.Payment.objects.create(registration=r, amount=D('99'), payment_type='Check',
                                    deleted_at='2026-01-01T00:00:00Z')
        cases['extra'] = (r.id, D('-20.00'))
        # A deleted registration.
        r = self.registration(300, completed=True, payment_type='Check',
                              initial_payment={'type': 'Full', 'total': 300},
                              deleted_at='2026-01-01T00:00:00Z')
        cases['deleted'] = (r.id, D('300.00'))
        # Full payment chosen, but paid in two checks.
        r = self.registration(300, completed=True, payment_type='Check',
                              initial_payment={'type': 'Full', 'total': 300})
        self.Payment.objects.create(registration=r, amount=D('150'), payment_type='Check')
        self.Payment.objects.create(registration=r, amount=D('150'), payment_type='Check')
        cases['rest'] = (r.id, D('0.00'))
        # A refund recorded by hand, as a negative payment.
        r = self.registration(300, completed=True, payment_type='Check',
                              initial_payment={'type': 'Full', 'total': 300})
        self.Payment.objects.create(registration=r, amount=D('300'), payment_type='Check')
        self.Payment.objects.create(registration=r, amount=D('-50'), payment_type='Check')
        cases['refund'] = (r.id, D('50.00'))
        # From before the first payment was kept on the registration: PayPal, paid.
        r = self.registration(205, 5, completed=True, payment_type='PayPal')
        self.Payment.objects.create(registration=r, amount=D('205'), payment_type='PayPal',
                                    paypal_order_details=paypal_details('ORDER-D', 'CAP-D',
                                                                        '205.00'))
        cases['old_paypal'] = (r.id, D('0.00'))
        # And by check, not paid yet.
        r = self.registration(120, completed=True, payment_type='Check')
        cases['old_check'] = (r.id, D('120.00'))
        # An incomplete registration, priced with a fee.
        r = self.registration(102.5, 2.5)
        incomplete = r.id
        # Completed with a fee, no initial payment and no payment type.
        r = self.registration(102.5, 2.5, completed=True)
        cases['stray'] = (r.id, D('102.50'))

        apps = self.migrate(AFTER)
        for name, (registration_id, balance) in cases.items():
            with self.subTest(name):
                self.assertEqual(self.balance(apps, registration_id), balance)

        Invoice = apps.get_model('camphoric', 'Invoice')
        Payment = apps.get_model('camphoric', 'Payment')
        Registration = apps.get_model('camphoric', 'Registration')
        PricingOverride = apps.get_model('camphoric', 'PricingOverride')

        paypal = Invoice.objects.get(registration_id=cases['paypal'][0])
        self.assertEqual((paypal.origin, paypal.description, paypal.amount, paypal.handling),
                         ('registration', 'Full', D('300.00'), D('7.50')))
        payment = Payment.objects.get(registration_id=cases['paypal'][0])
        self.assertEqual((payment.invoice_id, payment.paypal_transaction_id), (paypal.id, 'CAP-A'))
        self.assertNotIn('handling', Registration.objects.get(
            pk=cases['paypal'][0]).server_pricing_results)
        self.assertFalse(PricingOverride.objects.exists())

        deposit = Invoice.objects.get(registration_id=cases['deposit'][0])
        self.assertEqual((deposit.amount, deposit.handling, deposit.payment_type),
                         (D('550.00'), D('25.00'), 'Card'))

        unpaid = Invoice.objects.get(registration_id=cases['check_unpaid'][0])
        self.assertEqual((unpaid.amount, unpaid.payment_type), (D('150.00'), 'Check'))
        self.assertFalse(Payment.objects.filter(invoice=unpaid).exists())

        unverified = Invoice.objects.get(registration_id=cases['unverified'][0])
        self.assertEqual((unverified.pending_paypal_order_id, unverified.handling),
                         ('ORDER-C', D('7.50')))

        self.assertFalse(Invoice.objects.filter(registration_id=cases['free'][0]).exists())

        extra = Invoice.objects.filter(registration_id=cases['extra'][0]).order_by('id')
        self.assertEqual([(i.origin, i.amount, i.cancelled_at is not None) for i in extra], [
            ('registration', D('300.00'), False),
            ('payment_received', D('20.00'), False),
            ('payment_received', D('99.00'), True),
        ])

        # The second check goes on the registration invoice, which still had money due.
        rest = Invoice.objects.get(registration_id=cases['rest'][0])
        self.assertEqual(Payment.objects.filter(invoice=rest).count(), 2)
        # A deposit's invoice is paid by its check; the rest is a payment of its own.
        self.assertEqual(Invoice.objects.filter(registration_id=cases['check'][0]).count(), 1)

        refund = Invoice.objects.filter(registration_id=cases['refund'][0]).order_by('id')
        self.assertEqual([(i.description, i.amount) for i in refund],
                         [('Full', D('300.00')), ('Refund given', D('-50.00'))])

        old_paypal = Invoice.objects.get(registration_id=cases['old_paypal'][0])
        self.assertEqual((old_paypal.description, old_paypal.amount, old_paypal.handling,
                          old_paypal.payment_type),
                         ('Initial payment', D('200.00'), D('5.00'), 'PayPal'))
        self.assertEqual(Payment.objects.get(registration_id=cases['old_paypal'][0]).invoice_id,
                         old_paypal.id)
        old_check = Invoice.objects.get(registration_id=cases['old_check'][0])
        self.assertEqual((old_check.description, old_check.amount, old_check.payment_type),
                         ('Registration', D('120.00'), 'Check'))

        stray = Invoice.objects.get(registration_id=cases['stray'][0])
        self.assertEqual((stray.origin, stray.amount, stray.handling),
                         ('migrated', D('0.00'), D('2.50')))

        incomplete = Registration.objects.get(pk=incomplete)
        self.assertEqual(incomplete.server_pricing_results, {'total': 100, 'campers': []})
        self.assertFalse(Invoice.objects.filter(registration=incomplete).exists())

        completed = Registration.objects.get(pk=cases['check'][0])
        self.assertEqual(completed.completed_at, completed.created_at)
        self.assertEqual(completed.confirmation_sent_at, completed.created_at)
        self.assertIn('ORDER-C', self.output)

        # Back again: the old shape, then forward to the same balances.
        apps = self.migrate(BEFORE)
        Registration = apps.get_model('camphoric', 'Registration')
        old = Registration.objects.get(pk=cases['deposit'][0])
        self.assertEqual(old.server_pricing_results['total'], 1025)
        self.assertEqual(old.server_pricing_results['handling'], 25)
        self.assertEqual(old.initial_payment['total'], 575)
        self.assertEqual(old.payment_type, 'Card')
        old = Registration.objects.get(pk=cases['paypal'][0])
        self.assertEqual(old.paypal_response['id'], 'ORDER-A')

        apps = self.migrate(AFTER)
        for name, (registration_id, balance) in cases.items():
            with self.subTest(f'{name} again'):
                self.assertEqual(self.balance(apps, registration_id), balance)
