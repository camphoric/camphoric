'''
Promo codes (SPEC DR-67): who can use one, applying it while registering,
managing an event's codes, and soft-deleting them.
'''

import datetime

from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from freezegun import freeze_time
from rest_framework.test import APITestCase

from camphoric import models, roles
from tests.factories import make_user
from tests.test_views import create_standard_test_event


def make_promo_code(event, code='SUMMER', **fields):
    return models.PromoCode.objects.create(**{
        'event': event, 'label': 'Summer promo', 'code': code, 'pricing_logic': 25,
        **fields,
    })


class PromoCodeValidityTests(TestCase):
    def setUp(self):
        create_standard_test_event(self)

    def test_is_valid(self):
        now = timezone.now()
        with freeze_time(now):
            self.assertTrue(make_promo_code(self.event, 'A').is_valid())
            self.assertFalse(make_promo_code(self.event, 'B', enabled=False).is_valid())
            self.assertTrue(make_promo_code(
                self.event, 'C', expiration_date=now + datetime.timedelta(days=1)).is_valid())
            self.assertTrue(make_promo_code(self.event, 'D', expiration_date=now).is_valid())
            self.assertFalse(make_promo_code(
                self.event, 'E', expiration_date=now - datetime.timedelta(days=1)).is_valid())

    def test_find_valid_ignores_case_and_surrounding_space(self):
        promo_code = make_promo_code(self.event)
        self.assertEqual(models.PromoCode.find_valid(self.event, '  summer '), promo_code)
        self.assertIsNone(models.PromoCode.find_valid(self.event, 'winter'))
        self.assertIsNone(models.PromoCode.find_valid(self.event, ''))
        self.assertIsNone(models.PromoCode.find_valid(self.event, None))

    def test_find_valid_is_per_event(self):
        make_promo_code(self.event)
        other = models.Event.objects.create(organization=self.organization, name='Other')
        self.assertIsNone(models.PromoCode.find_valid(other, 'SUMMER'))

    def test_find_valid_skips_disabled_and_deleted_codes(self):
        make_promo_code(self.event, enabled=False)
        make_promo_code(self.event, 'GONE').soft_delete()
        self.assertIsNone(models.PromoCode.find_valid(self.event, 'SUMMER'))
        self.assertIsNone(models.PromoCode.find_valid(self.event, 'GONE'))

    def test_codes_are_unique_per_event_regardless_of_case(self):
        make_promo_code(self.event)
        with self.assertRaises(IntegrityError), transaction.atomic():
            make_promo_code(self.event, 'summer')
        other = models.Event.objects.create(organization=self.organization, name='Other')
        make_promo_code(other)

    def test_a_deleted_codes_text_can_be_used_again(self):
        make_promo_code(self.event).soft_delete()
        make_promo_code(self.event)
        self.assertEqual(models.PromoCode.all_objects.filter(code='SUMMER').count(), 2)


class RegisterWithPromoCodeTests(APITestCase):
    def setUp(self):
        cache.clear()  # the check endpoint's throttle
        create_standard_test_event(self)
        # 30% off the whole bill: the standard event totals 300 for two campers.
        self.promo_code = make_promo_code(
            self.event, pricing_logic={'*': [{'var': 'total'}, 0.3]})

    def register(self, **body):
        return self.client.post(f'/api/events/{self.event.id}/register', {
            'formData': self.valid_form_data, 'pricingResults': {}, **body,
        }, format='json')

    def check(self, code):
        return self.client.post(
            f'/api/events/{self.event.id}/checkpromo', {'code': code}, format='json')

    def test_register_offers_promo_codes_only_when_one_can_be_used(self):
        def has_promo_codes():
            return self.client.get(f'/api/events/{self.event.id}/register').data['hasPromoCodes']

        self.assertTrue(has_promo_codes())
        self.promo_code.enabled = False
        self.promo_code.save()
        self.assertFalse(has_promo_codes())
        make_promo_code(self.event, 'OLD', expiration_date=timezone.now() - datetime.timedelta(1))
        self.assertFalse(has_promo_codes())

    def test_a_valid_code_is_applied_and_priced(self):
        response = self.register(promoCode=' summer ')
        self.assertEqual(response.status_code, 200, response.data)
        registration = models.Registration.objects.get()
        self.assertEqual(registration.promo_code, self.promo_code)
        self.assertEqual(response.data['serverPricingResults']['promo'], -90)
        self.assertEqual(response.data['serverPricingResults']['total'], 210)
        self.assertEqual(registration.server_pricing_results['total'], 210)
        # The code isn't one of the registration's attributes.
        self.assertNotIn('promoCode', registration.attributes)

    def test_a_blank_code_is_ignored(self):
        for body in ({}, {'promoCode': ''}, {'promoCode': '  '}, {'promoCode': None}):
            with self.subTest(body=body):
                response = self.register(**body)
                self.assertEqual(response.status_code, 200, response.data)
                self.assertNotIn('promo', response.data['serverPricingResults'])
                self.assertEqual(response.data['serverPricingResults']['total'], 300)

    def test_a_code_the_registrant_cant_use_is_refused(self):
        make_promo_code(self.event, 'OFF', enabled=False)
        make_promo_code(self.event, 'OLD', expiration_date=timezone.now() - datetime.timedelta(1))
        make_promo_code(self.event, 'GONE').soft_delete()
        other = models.Event.objects.create(organization=self.organization, name='Other')
        make_promo_code(other, 'ELSEWHERE')
        for code in ('WINTER', 'OFF', 'OLD', 'GONE', 'ELSEWHERE'):
            with self.subTest(code=code):
                response = self.register(promoCode=code)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(
                    response.data['detail'], 'That promo code isn\'t valid for this event.')
                self.assertFalse(models.Registration.objects.exists())

    def test_the_code_stays_with_the_registration_once_it_expires(self):
        self.register(promoCode='SUMMER')
        registration = models.Registration.objects.get()
        self.promo_code.enabled = False
        self.promo_code.save()
        registration.save()  # recalculates
        self.assertEqual(registration.server_pricing_results['promo'], -90)

    def test_check_a_code(self):
        response = self.check('summer')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data, {
            'code': 'SUMMER', 'label': 'Summer promo', 'scope': 'registration',
            'pricingLogic': {'*': [{'var': 'total'}, 0.3]},
        })

    def test_check_a_bad_code(self):
        for code in ('nope', '', None, 7):
            with self.subTest(code=code):
                response = self.check(code)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(
                    response.data['detail'], 'That promo code isn\'t valid for this event.')
        self.assertEqual(self.client.post(
            '/api/events/0/checkpromo', {'code': 'SUMMER'}, format='json').status_code, 404)


class PromoCodeAdminTests(APITestCase):
    def setUp(self):
        create_standard_test_event(self)
        self.client.force_authenticate(make_user(roles.REGISTRAR, 'reggie'))
        self.promo_code = make_promo_code(self.event)

    def listed(self):
        response = self.client.get('/api/promocodes/', {'event': self.event.id})
        self.assertEqual(response.status_code, 200, response.data)
        return [row['id'] for row in response.data]

    def test_create_and_edit(self):
        response = self.client.post('/api/promocodes/', {
            'event': self.event.id, 'label': 'Early bird', 'code': ' early ',
            'pricing_logic': {'*': [{'var': 'camper.index'}, 10]}, 'scope': 'camper',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['code'], 'early')
        self.assertTrue(response.data['enabled'])

        response = self.client.patch(
            f'/api/promocodes/{response.data["id"]}/', {'enabled': False}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(response.data['enabled'])

    def test_codes_must_differ(self):
        response = self.client.post('/api/promocodes/', {
            'event': self.event.id, 'label': 'Again', 'code': 'summer', 'pricing_logic': 5,
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('code', response.data)

        response = self.client.post('/api/promocodes/', {
            'event': self.event.id, 'label': 'Blank', 'code': '  ', 'pricing_logic': 5,
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('code', response.data)

    def test_delete_keeps_it_on_registrations(self):
        registration = models.Registration.objects.create(
            event=self.event, registrant_email='pat@example.com', attributes={},
            promo_code=self.promo_code)
        self.assertEqual(registration.server_pricing_results['promo'], -25)

        preview = self.client.get(f'/api/promocodes/{self.promo_code.id}/delete-preview/').data
        self.assertTrue(preview['can_delete'])
        self.assertTrue(preview['restorable'])
        self.assertEqual(preview['changes'][0]['count'], 1)

        response = self.client.delete(f'/api/promocodes/{self.promo_code.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.listed(), [])
        self.assertIsNone(models.PromoCode.find_valid(self.event, 'SUMMER'))

        registration = models.Registration.objects.get(id=registration.id)
        self.assertEqual(registration.promo_code, self.promo_code)
        registration.save()  # recalculates
        self.assertEqual(registration.server_pricing_results['promo'], -25)
        response = self.client.get(f'/api/registrations/{registration.id}/')
        self.assertEqual(response.data['promo'], {
            'id': self.promo_code.id, 'code': 'SUMMER', 'label': 'Summer promo',
            'scope': 'registration', 'deleted': True,
        })

        deleted = self.client.get('/api/promocodes/deleted/', {'event': self.event.id}).data
        self.assertEqual([row['id'] for row in deleted], [self.promo_code.id])
        self.assertEqual(deleted[0]['deleted_by']['username'], 'reggie')

        response = self.client.post(f'/api/promocodes/{self.promo_code.id}/restore/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.listed(), [self.promo_code.id])

    def test_restore_refuses_a_clash(self):
        self.client.delete(f'/api/promocodes/{self.promo_code.id}/')
        make_promo_code(self.event, 'summer')
        response = self.client.post(f'/api/promocodes/{self.promo_code.id}/restore/')
        self.assertEqual(response.status_code, 409)

    def test_registrar_sets_a_registrations_code(self):
        registration = models.Registration.objects.create(
            event=self.event, registrant_email='pat@example.com', attributes={})
        url = f'/api/registrations/{registration.id}/'
        # Any live code of the event, whether registrants may still use it or not.
        self.promo_code.enabled = False
        self.promo_code.save()
        response = self.client.patch(url, {'promo_code': self.promo_code.id}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['server_pricing_results']['promo'], -25)

        other = models.Event.objects.create(organization=self.organization, name='Other')
        response = self.client.patch(
            url, {'promo_code': make_promo_code(other).id}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('promo_code', response.data)

        # A deleted code stays, but can't be newly given.
        self.promo_code.soft_delete()
        response = self.client.patch(url, {'promo_code': self.promo_code.id}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        gone = make_promo_code(self.event, 'GONE')
        gone.soft_delete()
        response = self.client.patch(url, {'promo_code': gone.id}, format='json')
        self.assertEqual(response.status_code, 400)

        response = self.client.patch(url, {'promo_code': None}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertNotIn('promo', response.data['server_pricing_results'])
