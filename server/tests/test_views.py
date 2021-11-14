import datetime
import json

from django.contrib.auth.models import User
from django.core import mail
from django.utils import timezone
import jsonschema  # Using Draft-7
from rest_framework.test import APITestCase, APIClient

from camphoric import models


class LoginTests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            'tom', 'tom@example.com', 'password')

    def test_bad_login(self):
        response = self.client.post('/api/login', format='json')
        self.assertEqual(response.status_code, 400)

        response = self.client.post(
            '/api/login',
            {'username': 'tom', 'password': 'wrongpassword'},
            format='json')
        self.assertEqual(response.status_code, 400)

        response = self.client.get('/api/organizations/')
        self.assertEqual(response.status_code, 401)

    def test_good_login(self):
        response = self.client.get('/api/user')
        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(
            str(response.content, encoding='utf8'),
            {'email': 'none', 'loggedIn': False})

        response = self.client.post(
            '/api/login',
            {'username': 'tom', 'password': 'password'},
            format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.cookies['sessionid']['httponly'])

        response = self.client.get('/api/user')
        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(
            str(response.content, encoding='utf8'),
            {'email': 'tom@example.com', 'loggedIn': True})

        response = self.client.get('/api/organizations/')
        self.assertEqual(response.status_code, 200)

    def test_logout(self):
        self.client.login(username='tom', password='password')

        response = self.client.get('/api/organizations/')
        self.assertEqual(response.status_code, 200)

        response = self.client.post('/api/logout')
        self.assertEqual(response.status_code, 200)

        response = self.client.get('/api/organizations/')
        self.assertEqual(response.status_code, 401)


class CSRFTests(APITestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.admin_user = User.objects.create_superuser(
            'tom', 'tom@example.com', 'password')

    def test_login_csrf(self):
        credentials = {'username': 'tom', 'password': 'password'}

        response = self.client.post('/api/login', credentials, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertIn('CSRF verification failed', str(response.content))

        response = self.client.get('/api/set-csrf-cookie', {}, format='json')
        csrftoken = response.cookies['csrftoken'].value

        response = self.client.post(
            '/api/login',
            credentials,
            HTTP_X_CSRFTOKEN=csrftoken,  # set the X-CSRFToken header
            format='json')
        self.assertEqual(response.status_code, 200)

    def test_crud_csrf(self):
        self.client.login(username='tom', password='password')

        response = self.client.post('/api/organizations/', {}, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertIn('CSRF Failed', str(response.content))

        response = self.client.get('/api/set-csrf-cookie', {}, format='json')
        csrftoken = response.cookies['csrftoken'].value

        response = self.client.post(
            '/api/organizations/',
            {},
            HTTP_X_CSRFTOKEN=csrftoken,  # set the X-CSRFToken header
            format='json')
        self.assertEqual(response.status_code, 400)


class RegisterGetTests(APITestCase):
    def setUp(self):
        self.organization = models.Organization.objects.create(name='Test Organization')

    def test_dataSchema(self):
        event = models.Event.objects.create(
            organization=self.organization,
            name='Test Data Event',
            registration_schema={
                'type': 'object',
                'properties': {
                    'billing_name': {'type': 'string'},
                    'billing_address': {'type': 'string'},
                },
            },

            camper_schema={
                'type': 'object',
                'properties': {
                    'name': {'type': 'string'},
                },
            },
        )

        response = self.client.get(f'/api/events/{event.id}/register')
        self.assertEqual(response.status_code, 200)
        jsonschema.Draft7Validator.check_schema(response.data['dataSchema'])
        self.assertEqual(response.data['dataSchema'], {
            'type': 'object',
            'definitions': {
                'camper': {
                    'type': 'object',
                    'properties': {
                        'name': {'type': 'string'},
                    },

                },
            },
            'required': ['registrant_email'],
            'properties': {
                'registrant_email': {
                    'type': 'string',
                    'format': 'email',
                    'title': 'Registrant email',
                },
                'campers': {
                    'type': 'array',
                    'minItems': 1,
                    'items': {
                        '$ref': '#/definitions/camper',
                    },
                },
                'billing_name': {'type': 'string'},
                'billing_address': {'type': 'string'},
            },
        })

    def test_uiSchema(self):
        event = models.Event.objects.create(
            organization=self.organization,
            name='Test uiSchema Event',
            registration_ui_schema={
                'ui:title': 'Test UI Schema',
                'ui:description': 'Test Description',
            }
        )
        response = self.client.get(f'/api/events/{event.id}/register')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['uiSchema'], {
            'ui:title': 'Test UI Schema',
            'ui:description': 'Test Description',
        })

    def test_pricing_fields(self):
        event = models.Event.objects.create(
            organization=self.organization,
            name='Test Price Fields',
            start=datetime.datetime(2019, 2, 25, 17, 0, 5, tzinfo=timezone.utc),
            pricing={
                'adult': 790,
                'teen': 680,
            },
            camper_pricing_logic=[
                {
                    'var': 'tuition',
                    'exp': {'+': [1, 2]},
                },
                {
                    'var': 'meals',
                    'exp': {'*': [2, 3]},
                },
                {
                    'var': 'total',
                    'exp': {'+': [{'var': 'tuition'}, {'var': 'meals'}]},
                },

            ],
            registration_pricing_logic=[
                {
                    'var': 'donation',
                    'exp': {'var': 'registration.donation'},
                },
                {
                    'var': 'total',
                    'exp': {'var': 'donation'},
                },
            ],
        )
        response = self.client.get(f'/api/events/{event.id}/register')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['pricing'], event.pricing)
        self.assertEqual(response.data['pricingLogic'], {
            'camper': event.camper_pricing_logic,
            'registration': event.registration_pricing_logic,
        })
        self.assertEqual(response.data['event'], {'start': {'day': 25, 'month': 2, 'year': 2019}})

    def test_invitation_code(self):
        event = models.Event.objects.create(organization=self.organization)
        registration_type = models.RegistrationType.objects.create(
            event=event,
            name='worktrade',
            label="Work-trade"
        )
        invitation = models.Invitation.objects.create(
            registration_type=registration_type,
            recipient_name='Campy McCampface',
            recipient_email='camper@example.com',
            expiration_time=datetime.datetime(2100, 1, 1, 1, 0, 0, tzinfo=timezone.utc)
        )

        # good email/code
        response = self.client.get(f'/api/events/{event.id}/register?email=camper@example.com&code={invitation.invitation_code}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['invitation'], {
            'recipient_name': 'Campy McCampface',
            'recipient_email': 'camper@example.com',
            'invitation_code': invitation.invitation_code,
        })
        self.assertEqual(response.data['registrationType'], {
            'name': 'worktrade',
            'label': 'Work-trade',
        })
        self.assertNotIn('invitationError', response.data)

        # bad email/code
        response = self.client.get(f'/api/events/{event.id}/register?email=nobody@example.com&code=blahblah')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('invitation', response.data)
        self.assertEqual(
            response.data['invitationError'],
            'Sorry, we couldn\'t find an invitation for "nobody@example.com" with code "blahblah"'
        )

        # already-redeemed invitation
        invitation.registration = models.Registration.objects.create(
            event=event,
            registrant_email='camper@example.com',
        )
        invitation.save()
        response = self.client.get(f'/api/events/{event.id}/register?email=camper@example.com&code={invitation.invitation_code}')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('invitation', response.data)
        self.assertEqual(
            response.data['invitationError'],
            'Sorry, that invitation code has already been redeemed',
        )

        # expired invitation
        invitation.registration = None
        invitation.expiration_time = datetime.datetime(2010, 1, 1, 1, 0, 0, tzinfo=timezone.utc)
        invitation.save()
        response = self.client.get(f'/api/events/{event.id}/register?email=camper@example.com&code={invitation.invitation_code}')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('invitation', response.data)
        self.assertEqual(
            response.data['invitationError'],
            'Sorry, that invitation code has expired',
        )

class RegisterPostTests(APITestCase):

    def setUp(self):
        self.organization = models.Organization.objects.create(name='Test Organization')
        self.event = models.Event.objects.create(
            organization=self.organization,
            name='Test Data Event',
            registration_schema={
                'type': 'object',
                'required': ['billing_name', 'billing_address'],
                'properties': {
                    'billing_name': {'type': 'string'},
                    'billing_address': {'type': 'string'},
                },
            },

            camper_schema={
                'type': 'object',
                'required': ['name'],
                'properties': {
                    'name': {'type': 'string'},
                },
            },
            pricing={},
            registration_pricing_logic=[
                {
                    'var': 'cabins',
                    'exp': {'*': [1, 100]},
                },
                {
                    'var': 'worktrade_discount',
                    'exp': {
                        'if': [
                            {'==': [
                                {'var': 'registration.registration_type'},
                                'worktrade',
                            ]},
                            -100,
                            0,
                        ],
                    },
                },
                {
                    'var': 'total',
                    'exp': {'+': [{'var': 'cabins'}, {'var': 'worktrade_discount'}]},
                },
            ],
            camper_pricing_logic=[
                {
                    'var': 'tuition',
                    'exp': {'*': [1, 100]},
                },
                {
                    'var': 'total',
                    'exp': {'var': 'tuition'},
                },
            ],
            confirmation_page_template='{{client renders this}}',
            confirmation_email_subject='Registration confirmation',
            confirmation_email_template=''.join([
                'Thanks for registering, {{registration.billing_name}}!\n',
                '\nCampers:\n',
                '{{#campers}}',
                '{{name}}\n',
                '{{/campers}}',
                '\n\nTotal due: ${{pricing_results.total}}\n',
            ]),
            confirmation_email_from='reg@camp.org',
        )
        self.valid_form_data = {
            'registrant_email': 'testi@mctesterson.com',
            'campers': [
                {'name': 'Testi McTesterton'},
                {'name': 'Testi McTesterton Junior'},
            ],
            'billing_name': 'Testi McTesterton',
            'billing_address': '1234 Average Street',
        }

    def test_post_errors(self):
        response = self.client.post('/api/events/0/register', {}, format='json')
        self.assertEqual(response.status_code, 404)

        response = self.client.post(f'/api/events/{self.event.id}/register', {}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertRegex(json.dumps(response.data), r'formData.*required', )

        response = self.client.post(
            f'/api/events/{self.event.id}/register',
            {'formData': {}},
            format='json')
        self.assertEqual(response.status_code, 400)
        self.assertRegex(json.dumps(response.data), r'pricingResults.*required')

        response = self.client.post(
            f'/api/events/{self.event.id}/register',
            {
                'formData': {**self.valid_form_data, 'billing_name': 2},
                'pricingResults': {},
            },

            format='json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertRegex(json.dumps(response.data), r'billing_name')

    def test_post_success(self):
        self.assertEqual(models.Registration.objects.count(), 0)
        expected_pricing_results = {
            'cabins': 100,
            'tuition': 200,
            'campers': [
                {'total': 100, 'tuition': 100},
                {'total': 100, 'tuition': 100},
            ],
            'worktrade_discount': 0,
            'total': 300,
        }
        response = self.client.post(
            f'/api/events/{self.event.id}/register',
            {
                'formData': self.valid_form_data,
                'pricingResults': expected_pricing_results,
            },
            format='json'
        )
        self.assertEqual(response.status_code, 200)
        registrations = models.Registration.objects.all()
        registration = registrations[0]
        campers = registration.campers.all()
        self.assertEqual(registration.attributes['billing_name'], 'Testi McTesterton')
        self.assertEqual(registration.attributes['billing_address'], '1234 Average Street')
        self.assertEqual(registration.event, self.event)
        self.assertEqual(len(campers), 2)
        self.assertEqual(campers[0].attributes['name'], 'Testi McTesterton')
        self.assertEqual(campers[1].attributes['name'], 'Testi McTesterton Junior')
        self.assertEqual(campers[0].registration, registration)
        self.assertEqual(campers[1].registration, registration)
        self.assertEqual(registration.server_pricing_results, expected_pricing_results)
        self.assertEqual(registration.client_reported_pricing, expected_pricing_results)

        self.assertEqual(response.data, {
            'confirmationPageTemplate': '{{client renders this}}',
            'emailError': False,
            'serverPricingResults': expected_pricing_results,
        })

        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.subject, 'Registration confirmation')
        self.assertEqual(message.body, """
Thanks for registering, Testi McTesterton!

Campers:
Testi McTesterton
Testi McTesterton Junior

Total due: $300
""".lstrip())
        self.assertEqual(message.from_email, 'reg@camp.org')
        self.assertEqual(message.to, ['testi@mctesterson.com'])

    def test_post_invitation(self):
        registration_type = models.RegistrationType.objects.create(
            event=self.event,
            name='worktrade',
            label="Work-trade"
        )
        invitation = models.Invitation.objects.create(
            registration_type=registration_type,
            recipient_email='camper@example.com',
        )

        # bad invitation email/code
        response = self.client.post(
            f'/api/events/{self.event.id}/register',
            {
                'formData': self.valid_form_data,
                'pricingResults': {},
                'invitation': {
                    'recipient_email': 'nobody@example.com',
                    'invitation_code': 'blahblah',
                },
            },
            format='json'
        )
        self.assertEqual(response.status_code, 400)

        # good invitation email/code
        self.assertEqual(models.Registration.objects.count(), 0)
        expected_pricing_results = {
            'cabins': 100,
            'tuition': 200,
            'campers': [
                {'total': 100, 'tuition': 100},
                {'total': 100, 'tuition': 100},
            ],
            'worktrade_discount': -100,
            'total': 200,
        }
        response = self.client.post(
            f'/api/events/{self.event.id}/register',
            {
                'formData': self.valid_form_data,
                'pricingResults': expected_pricing_results,
                'invitation': {
                    'recipient_email': 'camper@example.com',
                    'invitation_code': invitation.invitation_code,
                },
            },
            format='json'
        )
        self.assertEqual(response.status_code, 200)
        registrations = models.Registration.objects.all()
        registration = registrations[0]
        self.assertEqual(registration.server_pricing_results, expected_pricing_results)
        self.assertEqual(registration.registration_type.id, registration_type.id)
        invitation.refresh_from_db()
        self.assertEqual(invitation.registration.id, registration.id)


class SendInvitationPostTests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser("tom", "tom@example.com", "password")
        self.organization = models.Organization.objects.create(name='Test Organization')
        self.event = models.Event.objects.create(
            organization=self.organization,
            name='Test Data Event',
            confirmation_email_from="registrar@example.com"
        )

    def test_post(self):
        registration_type = models.RegistrationType.objects.create(
            event=self.event,
            name='worktrade',
            label="Work-trade",
            invitation_email_subject="Invitation to register",
            invitation_email_template='Hi {{recipient_name}}, here is your link: {{{register_link}}}',
        )
        invitation = models.Invitation.objects.create(
            registration_type=registration_type,
            recipient_name='Campy McCampface',
            recipient_email='camper@example.com',
            invitation_code='abc123',
        )

        #  Test unauthenticated request
        response = self.client.post(
            f'/api/invitations/{invitation.id}/send'
        )
        self.assertEqual(response.status_code, 401)

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(
            f'/api/invitations/{invitation.id}/send'
        )
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.from_email, "registrar@example.com")
        self.assertEqual(message.to, ['"Campy McCampface" <camper@example.com>'])
        self.assertEqual(message.subject, "Invitation to register")
        self.assertEqual(
            message.body, 
            f'Hi Campy McCampface, here is your link: http://testserver/events/{self.event.id}/register?email=camper@example.com&code=abc123')
        
        invitation.refresh_from_db()
        self.assertIsNotNone(invitation.sent_time)
        

class UsersTests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser("tom", "tom@example.com", "password")
        self.client.login(username='tom', password='password')

    def test_list_unauthorized(self):
        self.client.logout()
        response = self.client.get('/api/users/')
        self.assertEqual(response.status_code, 401)

    def test_list_authorized(self):
        response = self.client.get('/api/users/')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['username'], 'tom')
        self.assertNotIn('password', response.data[0])

    def test_create(self):

        response = self.client.post(
            '/api/users/',
            {'username': 'jerry'},
            format='json'
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username='jerry')
        self.assertFalse(user.has_usable_password())
        self.assertEqual(user.get_username(), 'jerry')
        self.assertIsInstance(user, User)
        self.assertEqual(len(User.objects.all()), 2)

    def test_edit(self):

        user = User.objects.create_user(username='jerry')
        self.assertEqual(user.email, '')

        response = self.client.put(
            f'/api/users/{user.id}/',
            {'username': 'jerry', 'email': 'jerry@example.com'},
            format='json'
        )

        self.assertEqual(response.status_code, 200)
        updated_user = User.objects.get(username='jerry')
        self.assertEqual(updated_user.email, 'jerry@example.com')

    def test_delete(self):

        user = User.objects.create_user(username='jerry')

        response = self.client.delete(f'/api/users/{user.id}/')
        self.assertEqual(response.status_code, 204)

        with self.assertRaises(User.DoesNotExist):
            User.objects.get(id=user.id)
