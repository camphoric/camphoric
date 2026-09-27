'''
Registering people after registration closes (issue #486): an organizer adds a
camper to an existing registration, or copies an invitation's registration
link to register someone themselves.
'''

from django.test import override_settings
from rest_framework.test import APITestCase

from camphoric import models, roles
from tests.factories import create_template_event, make_user


class AddCamperTests(APITestCase):
    def setUp(self):
        self.made = create_template_event()
        self.client.force_authenticate(make_user(roles.REGISTRAR, 'reggie'))

    def add(self, attributes, status=201):
        response = self.client.post('/api/campers/', {
            'registration': self.made.r1.id,
            'attributes': attributes,
            'admin_attributes': {},
            'sequence': 2,
        }, format='json')
        self.assertEqual(response.status_code, status, response.data)
        return response.data

    def test_a_camper_joins_an_existing_registration_and_the_price_follows(self):
        self.assertEqual(self.made.r1.server_pricing_results['total'], 825)
        data = self.add({
            'first_name': 'Robin', 'last_name': 'Alpha',
            # A `$ref` to the registration schema's shared definitions.
            'mailing_address': {'street': '2 Oak St', 'city': 'Albany'},
        })
        self.made.r1.refresh_from_db()
        self.assertEqual(self.made.r1.server_pricing_results['total'], 1225)
        camper = models.Camper.objects.get(id=data['id'])
        self.assertEqual(camper.server_pricing_results['tuition'], 400)
        self.assertEqual(list(self.made.r1.campers.values_list('sequence', flat=True)), [0, 1, 2])

    def test_its_answers_are_checked(self):
        response = self.add({'first_name': 'Robin', 'mailing_address': {'city': 7}}, status=400)
        self.assertIn('attributes', response)

    def test_reporters_cant(self):
        self.client.force_authenticate(make_user(roles.REPORTER, 'rita'))
        self.add({'first_name': 'Robin'}, status=403)


@override_settings(CAMPHORIC_PUBLIC_URL='https://reg.example.org')
class InvitationLinkTests(APITestCase):
    def setUp(self):
        self.made = create_template_event()
        self.client.force_authenticate(make_user(roles.REGISTRAR, 'reggie'))

    def test_an_invitation_carries_its_registration_link(self):
        invitation = models.Invitation.objects.create(
            registration_type=self.made.staff, recipient_email='pat+camp@example.com',
            invitation_code='abcd2345')
        data = self.client.get(f'/api/invitations/{invitation.id}/').data
        self.assertEqual(
            data['register_link'],
            f'https://reg.example.org/events/{self.made.event.id}/register'
            '?email=pat%2Bcamp@example.com&code=abcd2345')

    def test_the_link_works_after_registration_closes(self):
        invitation = self.made.pending
        link = self.client.get(f'/api/invitations/{invitation.id}/').data['register_link']
        query = link.split('?', 1)[1]
        self.made.event.registration_end = self.made.event.registration_start
        self.made.event.save()

        self.client.force_authenticate(None)
        page = self.client.get(f'/api/events/{self.made.event.id}/register?{query}')
        self.assertEqual(page.data['invitation']['invitation_code'], invitation.invitation_code)
        self.assertNotIn('invitationError', page.data)
