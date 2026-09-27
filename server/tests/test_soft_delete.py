'''
Registrations, campers and payments are soft-deleted through the admin API
(SPEC DR-55): gone from everything, until they're restored.
'''

from rest_framework.test import APITestCase

from camphoric import models, roles
from camphoric.lodging import LodgingTree
from tests.factories import create_template_event, make_user


class SoftDeleteTestCase(APITestCase):
    def setUp(self):
        self.made = create_template_event()
        self.registrar = make_user(roles.REGISTRAR, 'reggie')
        self.client.force_authenticate(self.registrar)
        self.report = models.Report.objects.create(
            event=self.made.event, title='Counts', output='txt', variables_source='server',
            template='{{ campers | length }} {{ payments | length }}')

    def delete(self, path):
        response = self.client.delete(path)
        self.assertEqual(response.status_code, 204, getattr(response, 'data', None))

    def restore(self, path, status=200):
        response = self.client.post(f'{path}restore/')
        self.assertEqual(response.status_code, status, response.data)
        return response

    def listed(self, path, **params):
        response = self.client.get(path, params)
        self.assertEqual(response.status_code, 200, response.data)
        return {row['id'] for row in response.data}

    def report_counts(self):
        response = self.client.post(f'/api/reports/{self.report.id}/render', {}, format='json')
        return response.data['report'].strip()

    def camper_count(self, lodging):
        return LodgingTree(self.made.event).build().get(lodging.id).camper_count


class RegistrationTests(SoftDeleteTestCase):
    def test_a_deleted_registration_is_gone_from_everything(self):
        made = self.made
        event = made.event.id
        self.assertEqual(self.report_counts(), '3 3')
        self.assertEqual(self.camper_count(made.cabin_a), 2)

        self.delete(f'/api/registrations/{made.r1.id}/')

        self.assertTrue(models.Registration.all_objects.get(id=made.r1.id).deleted_at)
        self.assertEqual(self.client.get(f'/api/registrations/{made.r1.id}/').status_code, 404)
        self.assertNotIn(made.r1.id, self.listed('/api/registrations/', event=event))
        campers = self.listed('/api/campers/', registration__event=event)
        self.assertFalse({made.c1.id, made.c2.id} & campers)
        self.assertFalse(models.Payment.objects.filter(registration=made.r1))
        self.assertFalse(models.CustomCharge.objects.filter(camper=made.c1))
        # Pat and Sam no longer fill Cabin A, and reports don't see them or their payment.
        self.assertEqual(self.camper_count(made.cabin_a), 0)
        self.assertEqual(self.report_counts(), '1 2')
        # The registrant can't pay for it either.
        response = self.client.post(f'/api/events/{event}/register', {
            'registrationUUID': str(made.r1.uuid), 'step': 'payment', 'paymentType': 'Check',
            'paymentData': {'type': 'Full', 'total': 100}}, format='json')
        self.assertEqual(response.status_code, 404)

    def test_restoring_brings_it_all_back_but_not_a_camper_deleted_before(self):
        made = self.made
        self.delete(f'/api/campers/{made.c2.id}/')
        self.delete(f'/api/registrations/{made.r1.id}/')

        response = self.restore(f'/api/registrations/{made.r1.id}/')
        self.assertIsNone(response.data['deleted_at'])
        campers = self.listed('/api/campers/', registration=made.r1.id)
        self.assertEqual(campers, {made.c1.id})
        self.assertEqual(len(self.listed('/api/payments/', registration=made.r1.id)), 1)
        self.assertTrue(models.CustomCharge.objects.filter(camper=made.c1))
        self.assertEqual(self.report_counts(), '2 3')

    def test_its_price_stays_while_deleted(self):
        registration = self.made.r1
        before = registration.server_pricing_results
        self.delete(f'/api/registrations/{registration.id}/')
        registration = models.Registration.all_objects.get(id=registration.id)
        self.assertEqual(registration.server_pricing_results, before)

    def test_the_delete_preview_lists_what_goes_out_of_sight(self):
        response = self.client.get(f'/api/registrations/{self.made.r1.id}/delete-preview/')
        preview = response.data
        self.assertTrue(preview['restorable'])
        hidden = {entry['type']: entry['items'] for entry in preview['deletes']}
        self.assertEqual(hidden, {
            'camper': ['Pat Alpha', 'Sam Alpha'],
            'payment': ['Check payment $100.00'],
            'customcharge': ['Linens $25.00'],
        })
        self.assertEqual(preview['changes'], [])

    def test_the_deleted_list_says_who(self):
        self.delete(f'/api/registrations/{self.made.r1.id}/')
        response = self.client.get('/api/registrations/deleted/', {'event': self.made.event.id})
        self.assertEqual(response.status_code, 200, response.data)
        row, = response.data
        self.assertEqual(row['registrant_email'], 'pat@example.com')
        self.assertEqual(row['camper_count'], 2)
        self.assertEqual(row['deleted_by']['username'], 'reggie')
        self.assertIsNotNone(row['deleted_at'])

    def test_its_history_can_still_be_read(self):
        self.delete(f'/api/registrations/{self.made.r1.id}/')
        response = self.client.get(f'/api/registrations/{self.made.r1.id}/history/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]['action'], 'delete')
        self.assertEqual(response.data[0]['actor']['username'], 'reggie')


class CamperTests(SoftDeleteTestCase):
    def test_deleting_and_restoring_a_camper_reprices_the_registration(self):
        made = self.made
        self.assertEqual(len(made.r1.server_pricing_results['campers']), 2)

        self.delete(f'/api/campers/{made.c2.id}/')
        made.r1.refresh_from_db()
        self.assertEqual(len(made.r1.server_pricing_results['campers']), 1)
        self.assertEqual(self.camper_count(made.cabin_a), 1)

        self.restore(f'/api/campers/{made.c2.id}/')
        made.r1.refresh_from_db()
        self.assertEqual(len(made.r1.server_pricing_results['campers']), 2)

    def test_one_whose_registration_is_deleted_comes_back_with_it(self):
        made = self.made
        self.delete(f'/api/campers/{made.c2.id}/')
        self.delete(f'/api/registrations/{made.r1.id}/')

        response = self.restore(f'/api/campers/{made.c2.id}/', status=409)
        self.assertEqual(response.data['detail'], 'Restore the registration first.')
        self.assertEqual(self.listed('/api/campers/deleted/', event=made.event.id), set())

    def test_deleted_campers_are_listed(self):
        self.delete(f'/api/campers/{self.made.c2.id}/')
        rows = self.client.get('/api/campers/deleted/', {'event': self.made.event.id}).data
        self.assertEqual([row['id'] for row in rows], [self.made.c2.id])
        self.assertEqual(rows[0]['deleted_by']['username'], 'reggie')

    def test_restoring_one_that_isnt_deleted_is_a_conflict(self):
        self.restore(f'/api/campers/{self.made.c1.id}/', status=409)

    def test_a_deleted_lodging_unassigns_a_deleted_camper_too(self):
        made = self.made
        self.delete(f'/api/campers/{made.c1.id}/')
        self.delete(f'/api/lodgings/{made.cabin_a.id}/')
        camper = models.Camper.all_objects.get(id=made.c1.id)
        self.assertIsNone(camper.lodging)
        self.assertIsNone(camper.stay)


class PaymentTests(SoftDeleteTestCase):
    def test_a_deleted_payment_is_gone_until_restored(self):
        made = self.made
        payment = models.Payment.objects.filter(registration=made.r2).first()

        self.delete(f'/api/payments/{payment.id}/')
        self.assertEqual(self.report_counts(), '3 2')
        self.assertEqual(len(self.listed('/api/payments/', registration=made.r2.id)), 1)
        deleted = self.listed('/api/payments/deleted/', registration=made.r2.id)
        self.assertEqual(deleted, {payment.id})

        self.restore(f'/api/payments/{payment.id}/')
        self.assertEqual(self.report_counts(), '3 3')

    def test_the_preview_says_it_can_be_restored(self):
        payment = models.Payment.objects.filter(registration=self.made.r1).get()
        preview = self.client.get(f'/api/payments/{payment.id}/delete-preview/').data
        self.assertEqual((preview['restorable'], preview['deletes']), (True, []))


class RulesTests(SoftDeleteTestCase):
    def test_deleted_at_cant_be_written(self):
        response = self.client.patch(
            f'/api/campers/{self.made.c1.id}/', {'deleted_at': '2026-01-01T00:00:00Z'},
            format='json')
        self.assertEqual(response.status_code, 200)
        self.made.c1.refresh_from_db()
        self.assertIsNone(self.made.c1.deleted_at)

    def test_reporters_cant_restore_or_list_deleted(self):
        self.delete(f'/api/campers/{self.made.c2.id}/')
        self.client.force_authenticate(make_user(roles.REPORTER, 'rita'))
        self.assertEqual(
            self.client.post(f'/api/campers/{self.made.c2.id}/restore/').status_code, 403)
        self.assertEqual(self.client.get(
            '/api/campers/deleted/', {'event': self.made.event.id}).status_code, 403)

    def test_the_deleted_list_needs_a_filter(self):
        self.assertEqual(self.client.get('/api/registrations/deleted/').status_code, 400)

    def test_an_invitation_whose_registration_is_deleted_says_so(self):
        made = self.made
        self.delete(f'/api/registrations/{made.r2.id}/')
        response = self.client.get(f'/api/invitations/{made.invited.id}/')
        self.assertEqual(response.data['registration'], made.r2.id)
        self.assertTrue(response.data['registration_deleted'])

    def test_an_event_with_only_deleted_registrations_still_cant_be_deleted(self):
        made = self.made
        for registration in (made.r1, made.r2, made.r3):
            self.delete(f'/api/registrations/{registration.id}/')
        self.client.force_authenticate(make_user(roles.ADMIN, 'boss'))
        self.assertEqual(self.client.delete(f'/api/events/{made.event.id}/').status_code, 409)
