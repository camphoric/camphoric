'''
An event's own payment types (SPEC §9.7, DR-164): offline ways of being paid
beyond the built-in Check, PayPal, Card and Voucher — imported with the event,
listed with labels by the event API, and checked against the payment's event
when a payment is recorded.
'''

from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from camphoric import models, roles
from tests.factories import create_template_event, make_user, registration_invoice

VENMO = {'value': 'Venmo', 'label': 'Venmo (@camp)'}
CASH = {'value': 'Cash', 'label': 'Cash'}


class EventPaymentTypesTests(APITestCase):
    '''What an event may define, and the full list the API gives for it.'''

    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()
        cls.superuser = User.objects.create_superuser('tom', 'tom@example.com', 'password')

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.superuser)

    def patch(self, payment_types, status=200):
        response = self.client.patch(f'/api/events/{self.made.event.id}/',
                                     {'payment_types': payment_types}, format='json')
        self.assertEqual(response.status_code, status, response.data)
        return response.data

    def test_imported_with_the_event(self):
        # The importer POSTs the event's fields to the events API as they are.
        response = self.client.post('/api/events/', {
            'organization': self.made.organization.id,
            'name': 'Imported Camp',
            'paypal_enabled': False,
            'payment_types': [VENMO, CASH],
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        event = models.Event.objects.get(pk=response.data['id'])
        self.assertEqual(event.payment_types, [VENMO, CASH])
        self.assertEqual(
            [(c['value'], c['label'], c['online']) for c in response.data['payment_type_choices']],
            [('Check', 'Check', False), ('Voucher', 'Discount or Gifted Credit', False),
             ('Venmo', 'Venmo (@camp)', False), ('Cash', 'Cash', False)])

    def test_an_event_without_its_own_types(self):
        event = models.Event.objects.create(organization=self.made.organization, name='Plain')
        self.assertEqual(event.payment_types, [])
        data = self.client.get(f'/api/events/{event.id}/').data
        self.assertEqual([c['value'] for c in data['payment_type_choices']],
                         ['Check', 'PayPal', 'Card', 'Voucher'])

    def test_online_types_only_while_paypal_is_enabled(self):
        data = self.patch([VENMO])
        self.assertEqual([(c['value'], c['online']) for c in data['payment_type_choices']],
                         [('Check', False), ('PayPal', True), ('Card', True),
                          ('Voucher', False), ('Venmo', False)])
        data = self.client.patch(f'/api/events/{self.made.event.id}/',
                                 {'paypal_enabled': False}, format='json').data
        self.assertEqual([c['value'] for c in data['payment_type_choices']],
                         ['Check', 'Voucher', 'Venmo'])

    def test_registration_still_offers_only_the_built_in_types(self):
        self.patch([VENMO])
        self.made.event.refresh_from_db()
        self.assertEqual(self.made.event.valid_payment_types, ['Check', 'PayPal', 'Card'])

    def test_values_and_labels_are_trimmed(self):
        data = self.patch([{'value': ' Zelle ', 'label': ' Zelle transfer '}])
        self.assertEqual(data['payment_types'], [{'value': 'Zelle', 'label': 'Zelle transfer'}])

    def test_refused(self):
        for payment_types, message in [
            ([{'value': 'check', 'label': 'Cheque'}], 'built-in'),
            ([{'value': 'CARD', 'label': 'Card'}], 'built-in'),
            ([VENMO, {'value': 'venmo', 'label': 'Venmo again'}], 'listed twice'),
            ([{'value': 'Venmo'}], 'just "value" and "label"'),
            ([{**VENMO, 'online': True}], 'just "value" and "label"'),
            ([{'value': '  ', 'label': 'Blank'}], '"value" is required'),
            ([{'value': 'Venmo', 'label': ''}], '"label" is required'),
            ([{'value': 'V' * 256, 'label': 'Long'}], 'at most 255'),
            ([{'value': 5, 'label': 'Five'}], '"value" is required'),
            ({'value': 'Venmo', 'label': 'Venmo'}, 'A list'),
        ]:
            with self.subTest(payment_types=payment_types):
                data = self.patch(payment_types, status=400)
                self.assertIn(message, str(data['payment_types']))


class RecordingAnEventTypeTests(APITestCase):
    '''A payment is a built-in type or one of its event's own.'''

    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()
        cls.made.event.payment_types = [VENMO, CASH]
        cls.made.event.save()
        cls.registrar = make_user(roles.REGISTRAR, 'reggie')

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.registrar)

    def record(self, status=201, **data):
        response = self.client.post('/api/payments/', {
            'registration': self.made.r2.id, 'amount': '20.00', 'attributes': {}, **data},
            format='json')
        self.assertEqual(response.status_code, status, response.data)
        return response.data

    def edit(self, payment_id, status=200, **data):
        response = self.client.patch(f'/api/payments/{payment_id}/', data, format='json')
        self.assertEqual(response.status_code, status, response.data)
        return response.data

    def drop_types(self):
        self.made.event.payment_types = [CASH]
        self.made.event.save()

    def test_an_event_type(self):
        data = self.record(payment_type='Venmo')
        payment = models.Payment.objects.get(pk=data['id'])
        self.assertEqual(payment.payment_type, 'Venmo')
        # Its "Payment received" invoice is to be paid the same way.
        self.assertEqual(payment.invoice.payment_type, 'Venmo')

    def test_every_built_in_type(self):
        for payment_type in models.PaymentType.values:
            with self.subTest(payment_type=payment_type):
                self.record(payment_type=payment_type)

    def test_a_type_the_event_doesnt_define(self):
        data = self.record(400, payment_type='Zelle')
        self.assertIn('Zelle', str(data['payment_type']))
        # The event's own types match exactly, as they're stored.
        self.record(400, payment_type='venmo')

    def test_another_events_type(self):
        other = models.Event.objects.create(
            organization=self.made.organization, name='Other Camp',
            payment_types=[{'value': 'Zelle', 'label': 'Zelle'}])
        self.assertTrue(other.accepts_payment_type('Zelle'))
        self.record(400, payment_type='Zelle')

    def test_changing_to_a_type_the_event_doesnt_define(self):
        data = self.record(payment_type='Check')
        self.edit(data['id'], 400, payment_type='Zelle')
        self.edit(data['id'], payment_type='Cash')

    def test_a_payment_whose_type_was_removed(self):
        data = self.record(payment_type='Venmo')
        self.drop_types()
        # It still loads, as what was stored.
        listed = self.client.get(f'/api/payments/{data["id"]}/')
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data['payment_type'], 'Venmo')
        payment = models.Payment.objects.get(pk=data['id'])
        self.assertEqual(models.payment_type_label('Venmo', self.made.event), 'Venmo')
        self.assertEqual(str(payment), 'Venmo payment $20.00')
        # The edit form sends every field back: the type it has stays allowed.
        self.edit(data['id'], payment_type='Venmo', notes='Late note')
        # It can still be refunded the way it was paid.
        self.record(refund_of=data['id'], amount='-5.00', payment_type='Venmo')
        # But no new payment can be recorded as it.
        self.record(400, payment_type='Venmo')

    def test_malformed_types_saved_outside_the_api(self):
        # The Django admin takes any JSON: what can't be read is left out, not a 500.
        event = self.made.event
        event.payment_types = ['Cash', {'value': 'Venmo'}, {'label': 'No value'},
                               {'value': 7, 'label': 'Seven'}]
        event.save()
        self.assertEqual([c['value'] for c in event.payment_type_choices][-1:], ['Venmo'])
        self.assertEqual(event.payment_type_choices[-1]['label'], 'Venmo')
        self.assertTrue(event.accepts_payment_type('Venmo'))
        self.assertFalse(event.accepts_payment_type('Cash'))
        self.assertEqual(models.payment_type_label('Venmo', event), 'Venmo')
        self.client.force_authenticate(User.objects.create_superuser('su', 'su@example.com', 'pw'))
        self.assertEqual(self.client.get('/api/events/').status_code, 200)
        self.record(payment_type='Venmo')
        listed = self.client.get(f'/api/events/{event.id}/').data
        self.assertEqual(listed['payment_types'], [{'value': 'Venmo', 'label': 'Venmo'}])
        # A built-in type's value, or one listed twice, is offered once.
        event.payment_types = [{'value': 'check', 'label': 'Cheque'}, VENMO,
                               {'value': 'VENMO', 'label': 'Again'}, None]
        event.save()
        listed = self.client.get(f'/api/events/{event.id}/').data
        self.assertEqual(listed['payment_types'], [VENMO])
        self.assertEqual([c['value'] for c in listed['payment_type_choices']],
                         ['Check', 'PayPal', 'Card', 'Voucher', 'Venmo'])
        self.assertEqual(models.payment_type_label('check', event), 'check')
        event.payment_types = {'not': 'a list'}
        event.save()
        self.assertEqual(self.client.get(f'/api/events/{event.id}/').status_code, 200)
        self.record(400, payment_type='Venmo')

    def test_moving_a_payment_to_another_events_registration(self):
        data = self.record(payment_type='Venmo')
        other = models.Event.objects.create(organization=self.made.organization, name='Other')
        elsewhere = models.Registration.objects.create(
            event=other, registrant_email='o@example.com')
        invoice = registration_invoice(elsewhere, 'Check', 100).id
        # Its type must suit the event it moves to, whether or not it's sent.
        for body in ({}, {'payment_type': 'Venmo'}):
            with self.subTest(body=body):
                refused = self.edit(data['id'], 400, registration=elsewhere.id,
                                    invoice=invoice, **body)
                self.assertIn('payment_type', refused)
        self.edit(data['id'], registration=elsewhere.id, invoice=invoice, payment_type='Check')

    def test_labels(self):
        event = self.made.event
        self.assertEqual(models.payment_type_label('Venmo', event), 'Venmo (@camp)')
        self.assertEqual(models.payment_type_label('Card', event), 'Debit or Credit Card')
        self.assertEqual(models.payment_type_label('Venmo'), 'Venmo')
        self.assertEqual(models.payment_type_label('Gone', event), 'Gone')
