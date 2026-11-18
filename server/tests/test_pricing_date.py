'''
Which moment a registration is priced as of (#805; SPEC §9.2, DR-167): pricing's
`date` and `event.is_open` are read then. A draft is priced as of now, up to the
payment button; a completed registration as of its completion, however late it's
repriced, so an organizer's edit months on doesn't move an early-bird rate or a
closed-registration fee.
'''

import datetime
from decimal import Decimal
from unittest import mock

from freezegun import freeze_time
from rest_framework.test import APITestCase

from camphoric import models, roles, views
from tests import paypal_mocks
from tests.factories import make_user

UTC = datetime.timezone.utc
EARLY_BIRD_ENDS = datetime.datetime(2026, 3, 1, tzinfo=UTC)
SUBMITTED = '2026-02-01 10:00:00'  # registration open, early-bird rate
PAID_EARLY = '2026-02-03 10:00:00'  # still both
PAID_LATE = '2026-09-01 10:00:00'  # registration closed, early bird long over
EDITED = '2026-10-15 10:00:00'

EARLY, LATE, CLOSED_FEE = 300, 400, 50


def make_event(**fields):
    return models.Event.objects.create(
        organization=models.Organization.objects.create(name='Org'),
        name='Early Bird Camp',
        registration_start=datetime.datetime(2026, 1, 1, tzinfo=UTC),
        registration_end=datetime.datetime(2026, 6, 1, tzinfo=UTC),
        pricing={'early': EARLY, 'late': LATE, 'closed_fee': CLOSED_FEE},
        registration_pricing_logic=[
            {'var': 'fee', 'label': 'Fee', 'exp': {'if': [
                {'<': [{'var': 'date.epoch'}, int(EARLY_BIRD_ENDS.timestamp())]},
                {'var': 'pricing.early'}, {'var': 'pricing.late'}]}},
            {'var': 'closed_fee', 'label': 'Late registration', 'exp': {'if': [
                {'var': 'event.is_open'}, 0, {'var': 'pricing.closed_fee'}]}},
            {'var': 'total', 'label': 'Total',
             'exp': {'+': [{'var': 'fee'}, {'var': 'closed_fee'}]}},
        ],
        camper_pricing_logic=[],
        confirmation_email_from='camp@example.com',
        **fields)


class AnOrganizersEditTests(APITestCase):
    def setUp(self):
        self.event = make_event()

    def make(self, **fields):
        with freeze_time(SUBMITTED):
            registration = models.Registration.objects.create(
                event=self.event, registrant_email='pat@example.com', attributes={}, **fields)
            camper = models.Camper.objects.create(registration=registration, attributes={})
        return registration, camper

    def make_completed(self):
        with freeze_time(SUBMITTED):
            return self.make(completed_at=datetime.datetime(2026, 2, 1, 10, tzinfo=UTC))

    @staticmethod
    def results(registration):
        return models.Registration.all_objects.get(pk=registration.pk).server_pricing_results

    def test_an_edit_months_later_keeps_the_rate_it_was_completed_at(self):
        registration, camper = self.make_completed()
        self.assertEqual(self.results(registration)['total'], EARLY)
        with freeze_time(EDITED):
            registration.attributes = {'note': 'typo fixed'}
            registration.save()
            self.assertEqual(self.results(registration)['total'], EARLY)
            camper.attributes = {'name': 'Pat'}
            camper.save()
            self.assertEqual(self.results(registration)['total'], EARLY)
            shirt = models.CustomChargeType.objects.create(
                event=self.event, label='T-shirt', name='shirt')
            models.CustomCharge.objects.create(
                camper=camper, custom_charge_type=shirt, amount=20)
        results = self.results(registration)
        self.assertEqual((results['fee'], results['closed_fee']), (EARLY, 0))

    def test_an_edit_through_the_api_keeps_it(self):
        registration, _ = self.make_completed()
        self.client.force_authenticate(make_user(roles.ADMIN, 'boss'))
        with freeze_time(EDITED):
            response = self.client.patch(
                f'/api/registrations/{registration.id}/',
                {'attributes': {'note': 'typo fixed'}}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['server_pricing_results']['total'], EARLY)

    def test_one_never_completed_is_priced_as_of_when_it_was_made(self):
        registration, _ = self.make()
        with freeze_time(EDITED):
            registration.save()
        self.assertEqual(self.results(registration)['total'], EARLY)

    def test_one_an_organizer_adds_after_the_deadline_is_priced_as_of_then(self):
        self.client.force_authenticate(make_user(roles.ADMIN, 'boss'))
        with freeze_time(EDITED):
            response = self.client.post('/api/registrations/', {
                'event': self.event.id, 'registrant_email': 'lee@example.com',
                'attributes': {}}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['server_pricing_results']['total'], LATE + CLOSED_FEE)


class PayingTests(paypal_mocks.PayPalServerMixin, APITestCase):
    '''Submitted while the early-bird rate held; a draft's price is today's until it's paid.'''

    def setUp(self):
        super().setUp()
        self.event = make_event(paypal_client_id='client', epayment_handling=Decimal('2.5'))
        with freeze_time(SUBMITTED):
            self.sent = self.post(step='registration', pricingResults={}, formData={
                'registrant_email': 'pat@example.com', 'campers': [{}]}).data
        self.assertEqual(self.sent['serverPricingResults']['total'], EARLY)

    def post(self, status=200, **data):
        response = self.client.post(
            f'/api/events/{self.event.id}/register', data, format='json')
        self.assertEqual(response.status_code, status, getattr(response, 'data', None))
        return response

    def payment_step(self):
        return self.post(step='payment-step',
                         registrationUUID=str(self.sent['registrationUUID'])).data

    def pay(self, status=200, quote=None, **data):
        return self.post(status, registrationUUID=str(self.sent['registrationUUID']),
                         quote=quote or self.sent['quote'], **data)

    @property
    def registration(self):
        return models.Registration.objects.get(uuid=self.sent['registrationUUID'])

    def test_paid_after_the_deadline_it_costs_what_it_does_then(self):
        with freeze_time(PAID_LATE):
            step = self.payment_step()
            self.assertEqual(step['serverPricingResults']['total'], LATE + CLOSED_FEE)
            # A page still showing the early rate is shown the new one, not charged it.
            refused = self.pay(409, step='payment', paymentType='Check')
            self.assertEqual(refused.data['code'], 'invoice_changed')
            self.pay(step='payment', paymentType='Check', quote=step['quote'])
        registration = self.registration
        self.assertEqual(registration.server_pricing_results['total'], LATE + CLOSED_FEE)
        self.assertEqual(registration.invoices.get().amount, Decimal(LATE + CLOSED_FEE))
        self.assertEqual(registration.completed_at,
                         datetime.datetime(2026, 9, 1, 10, tzinfo=UTC))

    def test_the_paypal_invoice_asks_what_it_costs_when_paid(self):
        self.reply(paypal_mocks.created())
        with freeze_time(PAID_LATE):
            order = self.pay(step='paypal-order', paymentType='PayPal',
                             quote=self.payment_step()['quote']).data
        invoice = self.registration.invoices.get()
        self.assertEqual(invoice.amount, Decimal(LATE + CLOSED_FEE))
        self.assertEqual(order['total'], 461.25)  # with the 2.5% handling fee

    def test_paid_before_the_deadline_an_edit_after_it_keeps_the_early_rate(self):
        with freeze_time(PAID_EARLY):
            self.pay(step='payment', paymentType='Check')
        with freeze_time(EDITED):
            registration = self.registration
            registration.attributes = {'note': 'typo fixed'}
            registration.save()
        self.assertEqual(self.registration.server_pricing_results['total'], EARLY)

    def test_a_price_changed_before_the_paypal_invoice_is_written_is_refused(self):
        # An organizer's edit lands between completing it and writing its invoice:
        # the invoice isn't made from the price the page showed.
        locked = views.RegisterView.locked_registration.__func__

        def edited_first(cls, request, event):
            registration = self.registration
            self.event.registration_pricing_logic = [
                {'var': 'total', 'exp': {'+': [EARLY, 100]}}]
            self.event.save()
            registration.save()
            return locked(cls, request, event)

        self.reply(paypal_mocks.created())
        with freeze_time(PAID_EARLY), mock.patch.object(
                views.RegisterView, 'locked_registration', classmethod(edited_first)):
            response = self.pay(409, step='paypal-order', paymentType='PayPal')
        self.assertEqual(response.data['code'], 'invoice_changed')
        self.assertEqual(
            response.data['paymentStep']['serverPricingResults']['total'], EARLY + 100)
        self.assertFalse(models.Invoice.objects.exists())
