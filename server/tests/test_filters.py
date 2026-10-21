'''
The admin API's list filters (camphoric.filters, #935): every list of an
event's records filters by `event`, and a list refuses a query parameter it
doesn't filter by, instead of quietly returning every row.
'''

from decimal import Decimal

from rest_framework.test import APITestCase

from camphoric import models, roles
from tests.factories import create_template_event, make_user


class FilterTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()
        # The other event's invitations reuse these codes and addresses.
        cls.made.invited.invitation_code = 'aaaa2222'
        cls.made.invited.save()
        cls.made.pending.invitation_code = 'bbbb3333'
        cls.made.pending.save()
        cls.other = create_template_event()
        for made in (cls.made, cls.other):
            models.PricingOverride.objects.create(
                registration=made.r1, var='donation', amount=Decimal('0'), reason='Waived')
        cls.registrar = make_user(roles.REGISTRAR, 'reggie')

    def setUp(self):
        self.client.force_authenticate(self.registrar)

    def listed(self, path, **params):
        response = self.client.get(path, params)
        self.assertEqual(response.status_code, 200, response.data)
        rows = response.data['results'] if isinstance(response.data, dict) else response.data
        return {row['id'] for row in rows}


class EventFilterTests(FilterTestCase):
    def test_every_list_of_an_events_records_filters_by_event(self):
        lists = {
            '/api/invitations/': models.Invitation.objects.filter(
                registration_type__event=self.made.event),
            '/api/campers/': models.Camper.objects.filter(registration__event=self.made.event),
            '/api/pricingoverrides/': models.PricingOverride.objects.filter(
                registration__event=self.made.event),
            '/api/invoices/': models.Invoice.objects.filter(registration__event=self.made.event),
            '/api/payments/': models.Payment.objects.filter(registration__event=self.made.event),
            '/api/customcharges/': models.CustomCharge.objects.filter(
                custom_charge_type__event=self.made.event),
            '/api/registrations/': models.Registration.objects.filter(event=self.made.event),
            '/api/lodgings/': models.Lodging.objects.filter(event=self.made.event),
        }
        for path, expected in lists.items():
            with self.subTest(path):
                ids = set(expected.values_list('id', flat=True))
                self.assertTrue(ids)
                self.assertEqual(self.listed(path, event=self.made.event.id), ids)

    def test_the_longer_names_still_filter_by_event(self):
        event = self.made.event.id
        self.assertEqual(
            self.listed('/api/invitations/', registration_type__event=event),
            {self.made.invited.id, self.made.pending.id})
        self.assertEqual(
            self.listed('/api/campers/', registration__event=event),
            {self.made.c1.id, self.made.c2.id, self.made.c3.id, self.made.c4.id})
        self.assertEqual(
            self.listed('/api/customcharges/', custom_charge_type__event=event),
            set(models.CustomCharge.objects.filter(
                camper__registration__event=event).values_list('id', flat=True)))

    def test_an_event_that_isnt_there_is_refused(self):
        response = self.client.get('/api/campers/', {'event': 999999})
        self.assertEqual(response.status_code, 400)
        self.assertIn('event', response.data)


class OtherFilterTests(FilterTestCase):
    def test_invitations_and_registrations_filter_by_registration_type(self):
        staff = self.made.staff.id
        self.assertEqual(self.listed('/api/invitations/', registration_type=staff),
                         {self.made.invited.id, self.made.pending.id})
        self.assertEqual(self.listed('/api/registrations/', registration_type=staff),
                         {self.made.r2.id})

    def test_campers_filter_by_lodging(self):
        self.assertEqual(self.listed('/api/campers/', lodging=self.made.cabin_a.id),
                         {self.made.c1.id, self.made.c2.id})

    def test_custom_charges_filter_by_type(self):
        self.assertEqual(
            self.listed('/api/customcharges/', custom_charge_type=self.made.linens.id),
            set(self.made.linens.customcharge_set.values_list('id', flat=True)))


class UnknownParameterTests(FilterTestCase):
    def test_a_list_refuses_a_parameter_it_doesnt_filter_by(self):
        response = self.client.get('/api/invitations/', {'evnt': self.made.event.id})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(list(response.data), ['evnt'])
        self.assertIn('registration_type', str(response.data['evnt'][0]))

    def test_so_does_a_list_with_no_filters(self):
        response = self.client.get('/api/organizations/', {'event': self.made.event.id})
        self.assertEqual(response.status_code, 400)
        self.assertIn('event', response.data)

    def test_format_paging_and_a_views_own_parameters_are_allowed(self):
        event = self.made.event.id
        self.listed('/api/registrations/', event=event, format='json')
        self.listed('/api/emailmessages/', event=event, page=1, q='pat')
        self.listed('/api/leases/', event=event)

    def test_a_single_record_ignores_extra_parameters(self):
        response = self.client.get(f'/api/campers/{self.made.c1.id}/', {'cachebust': 1})
        self.assertEqual(response.status_code, 200)


class EventListFilterTests(FilterTestCase):
    def test_the_public_event_list_filters_by_organization(self):
        response = self.client.get('/api/eventlist', {'organization': self.made.organization.id})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([event['url'] for event in response.data],
                         [f'/events/{self.made.event.id}/register'])

    def test_and_ignores_other_parameters_and_an_organization_that_isnt_an_id(self):
        for params in ({'_': 123}, {'organization': 'larkcamp'}):
            with self.subTest(params):
                response = self.client.get('/api/eventlist', params)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(len(response.data), 2)
