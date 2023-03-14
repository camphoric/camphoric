import copy
import datetime
import json
import os.path

from django.conf import settings
from django.contrib.auth.models import User
from django.core import mail
from django.utils import timezone
import jsonschema  # Using Draft-7
from rest_framework.test import APITestCase, APIClient

from camphoric import models
from camphoric.lodging import LODGING_SCHEMA
from camphoric.test.mock_server import MockServer


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
        self.assertEqual(response.data['username'], '')
        self.assertEqual(response.data['last_login'], None)
        self.assertEqual(response.data['is_superuser'], False)
        self.assertEqual(response.data['is_staff'], False)
        self.assertEqual(response.data['is_active'], False)
        self.assertNotIn('email', response.data)

        response = self.client.post(
            '/api/login',
            {'username': 'tom', 'password': 'password'},
            format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.cookies['sessionid']['httponly'])

        self.assertEqual(response.data['email'], 'tom@example.com')
        self.assertEqual(response.data['first_name'], '')
        self.assertEqual(response.data['is_active'], True)
        self.assertEqual(response.data['is_staff'], True)
        self.assertEqual(response.data['is_superuser'], True)
        self.assertEqual(response.data['last_name'], '')
        self.assertEqual(response.data['username'], 'tom')

        response = self.client.get('/api/user')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['email'], 'tom@example.com')
        self.assertEqual(response.data['first_name'], '')
        self.assertEqual(response.data['is_active'], True)
        self.assertEqual(response.data['is_staff'], True)
        self.assertEqual(response.data['is_superuser'], True)
        self.assertEqual(response.data['last_name'], '')
        self.assertEqual(response.data['username'], 'tom')

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

        response = self.client.get('/api/user')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['username'], '')
        self.assertEqual(response.data['last_login'], None)
        self.assertEqual(response.data['is_superuser'], False)
        self.assertEqual(response.data['is_staff'], False)
        self.assertEqual(response.data['is_active'], False)
        self.assertNotIn('email', response.data)


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


class EventListGetTests(APITestCase):
    def setUp(self):
        self.organization = models.Organization.objects.create(name='Test Organization')
        self.event = models.Event.objects.create(
                organization=self.organization,
                name='Test Data Event 1',
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

    def test_get(self):
        response = self.client.get('/api/eventlist')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [{
            'name': 'Test Data Event 1',
            'open': True,
            'url': f'/events/{self.event.id}/register',
        }])


class RegisterGetTests(APITestCase):
    def setUp(self):
        self.organization = models.Organization.objects.create(name='Test Organization')

    def test_reg_close(self):
        event = models.Event.objects.create(
            organization=self.organization,
            name='Test Data Event',
            registration_end=datetime.date.today() - datetime.timedelta(days=1),
        )

        response = self.client.get(f'/api/events/{event.id}/register')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['event']['is_open'], False)

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

        lodging_root = event.lodging_set.create(
            name='Lodging',
            children_title='Please choose a lodging option',
            visible=True,
        )
        event.lodging_set.create(
            name='Cabin',
            parent=lodging_root,
            visible=True,
            capacity=100,
        )
        event.lodging_set.create(
            name='Tent',
            parent=lodging_root,
            visible=True,
            capacity=100,
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
                        'lodging': {
                            'type': 'object',
                            'title': 'Lodging',
                            'properties': LODGING_SCHEMA['properties'],
                            'dependencies': LODGING_SCHEMA['dependencies'],
                        },
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
                    'maxItems': 20,
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

                # to test that camper UI schema is merged correctly with lodging UI schema
                'campers': {
                    'ui:description': 'stuff about campers',
                    'items': {
                        'ui:description': 'stuff about a camper',
                        'lodging': {
                            'ui:description': 'stuff about lodging',
                        },
                    },
                },
            }
        )

        # lodging
        root = event.lodging_set.create(
            name='root')
        camp1 = event.lodging_set.create(
            name='camp1', visible=True, parent=root, capacity=1)
        camp2 = event.lodging_set.create(
            name='camp2', visible=True, parent=root, capacity=1)
        registration = event.registration_set.create(
            event=event,
            attributes={},
            registrant_email='registrant@example.com',
        )
        registration.campers.create(lodging=camp1)
        response = self.client.get(f'/api/events/{event.id}/register')
        self.assertEqual(response.status_code, 200)

        self.assertEqual(response.data['uiSchema']['ui:title'], 'Test UI Schema')
        self.assertEqual(response.data['uiSchema']['ui:description'], 'Test Description')

        campers_ui = response.data['uiSchema']['campers']

        self.maxDiff = None
        self.assertEqual(campers_ui['ui:description'], 'stuff about campers')
        self.assertEqual(
            campers_ui['items']['lodging']['lodging_requested']['lodging_nodes'],
            [
                {
                    'camper_count_adjusted': 1.0,
                    'capacity': 1,
                    'children_title': '',
                    'deleted_at': None,
                    'event': event.id,
                    'id': camp1.id,
                    'name': 'camp1',
                    'notes': '',
                    'parent': root.id,
                    'remaining_unreserved_capacity': 0,
                    'reserved': 0,
                    'sharing_multiplier': 1.0,
                    'visible': True},
                {
                    'camper_count_adjusted': 0,
                    'capacity': 1,
                    'children_title': '',
                    'deleted_at': None,
                    'event': event.id,
                    'id': camp2.id,
                    'name': 'camp2',
                    'notes': '',
                    'parent': root.id,
                    'remaining_unreserved_capacity': 1,
                    'reserved': 0,
                    'sharing_multiplier': 1.0,
                    'visible': True}
            ]
        )

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

            paypal_enabled=True,
            paypal_client_id='test-client-id',
        )
        response = self.client.get(f'/api/events/{event.id}/register')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['pricing'], event.pricing)
        self.assertEqual(response.data['pricingLogic'], {
            'camper': event.camper_pricing_logic,
            'registration': event.registration_pricing_logic,
        })
        self.assertEqual(
            response.data['event'],
            {
                'start': {'day': 25, 'month': 2, 'year': 2019},
                'is_open': True,
            }
        )
        self.assertEqual(response.data['payPalOptions'], {
            'client-id': 'test-client-id',
        })

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
        response = self.client.get(
            f'/api/events/{event.id}/register?email=camper@example.com&code='
            + invitation.invitation_code)
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
        response = self.client.get(
            f'/api/events/{event.id}/register?email=nobody@example.com&code=blahblah')
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
            completed=True,
        )
        invitation.save()
        response = self.client.get(
            f'/api/events/{event.id}/register?email=camper@example.com&code='
            + invitation.invitation_code)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('invitation', response.data)
        self.assertEqual(
            response.data['invitationError'],
            'Sorry, that invitation code has already been redeemed',
        )

        # not-quite-redeemed invitation (incomplete registration)
        invitation.registration.completed = False
        invitation.registration.save()
        response = self.client.get(
            f'/api/events/{event.id}/register?email=camper@example.com&code='
            + invitation.invitation_code)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['invitation'], {
            'recipient_name': 'Campy McCampface',
            'recipient_email': 'camper@example.com',
            'invitation_code': invitation.invitation_code,
        })

        # expired invitation
        invitation.registration = None
        invitation.expiration_time = datetime.datetime(2010, 1, 1, 1, 0, 0, tzinfo=timezone.utc)
        invitation.save()
        response = self.client.get(
            f'/api/events/{event.id}/register?email=camper@example.com&code='
            + invitation.invitation_code)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('invitation', response.data)
        self.assertEqual(
            response.data['invitationError'],
            'Sorry, that invitation code has expired',
        )


class RegisterPostTests(APITestCase):
    @classmethod
    def setUpClass(cls):
        cls.paypal_server = MockServer()
        cls.paypal_server.start()
        settings.PAYPAL_BASE_URL = f'http://{cls.paypal_server.host}:{cls.paypal_server.port}'
        settings.PAYPAL_CLIENT_ID = 'test-client-id'
        settings.PAYPAL_SECRET = 'test-secret'

    @classmethod
    def tearDownClass(cls):
        cls.paypal_server.stop()

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
                'Thanks for registering, {{registration.attributes.billing_name}}!\n',
                '\nCampers:\n',
                '| Name | Total |\n',
                '| ---- | ----- |\n',
                '{{#campers}}',
                '| {{name}} | {{pricing_result.total}} |\n',
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

    def test_post_flow(self):
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

        with open(os.path.join(
            os.path.dirname(__file__),
            'data',
            'paypal_sample_order_details_response.json'
        )) as f:
            sample_order_details_response = json.load(f)

        #
        # registration step
        #

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
        self.assertEqual(len(registrations), 1)
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
        self.assertFalse(registration.completed)

        self.assertEqual(response.data, {
            'deposit': None,
            'registrationUUID': registration.uuid,
            'serverPricingResults': expected_pricing_results,
        })

        #
        # payment step
        #

        paypal_response_from_client = sample_order_details_response
        paypal_order_details = copy.deepcopy(sample_order_details_response)
        paypal_order_details['purchase_units'][0]['reference_id'] = str(registration.uuid)
        paypal_order_details['purchase_units'][0]['amount']['value'] = '300.00'
        paypal_order_details['status'] = 'COMPLETED'
        self.paypal_server.add_mock_response(200, {}, paypal_order_details)

        response = self.client.post(
            f'/api/events/{self.event.id}/register',
            {
                'registrationUUID': registration.uuid,
                'step': 'payment',
                'paymentType': 'PayPal',
                'paymentData': {
                    'type': 'Full',
                    'total': 300,
                },
                'payPalResponse': paypal_response_from_client,
            },
            format='json'
        )
        self.assertEqual(response.status_code, 200)

        self.assertEqual(response.data, {
            'confirmationPageTemplate': '{{client renders this}}',
            'initialPayment': {'balance': 0, 'total': 300, 'type': 'Full'},
            'emailError': False,
            'serverPricingResults': expected_pricing_results,
        })

        registration.refresh_from_db()
        self.assertTrue(registration.completed)
        self.assertEqual(registration.payment_type, 'PayPal')
        self.assertEqual(registration.paypal_response, paypal_response_from_client)

        payments = registration.payment_set.all()
        self.assertEqual(len(payments), 1)
        payment = payments[0]
        self.assertEqual(payment.paypal_order_details, paypal_order_details)
        self.assertEqual(payment.amount, 300)

        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]

        self.assertEqual(message.subject, 'Registration confirmation')
        self.assertEqual(message.body, """
Thanks for registering, Testi McTesterton!

Campers:
| Name | Total |
| ---- | ----- |
| Testi McTesterton | 100 |
| Testi McTesterton Junior | 100 |

Total due: $300
""".lstrip())
        self.assertEqual(len(message.alternatives), 1)
        self.assertIsInstance(message.alternatives[0], tuple)
        self.assertEqual(message.alternatives[0][1], "text/html")
        self.assertEqual(message.alternatives[0][0], """
<p>Thanks for registering, Testi McTesterton!</p>
<p>Campers:</p>
<table>
<thead>
<tr>
<th>Name</th>
<th>Total</th>
</tr>
</thead>
<tbody>
<tr>
<td>Testi McTesterton</td>
<td>100</td>
</tr>
<tr>
<td>Testi McTesterton Junior</td>
<td>100</td>
</tr>
</tbody>
</table>
<p>Total due: $300</p>
""".lstrip())

        self.assertEqual(message.from_email, 'reg@camp.org')
        self.assertEqual(message.to, ['testi@mctesterson.com'])

    def test_post_lodging(self):
        lodging_root = self.event.lodging_set.create(
            name='Lodging',
            children_title='Please choose a lodging option',
            visible=True,
        )
        cabin = self.event.lodging_set.create(
            name='Cabin',
            parent=lodging_root,
            visible=True,
        )
        tent = self.event.lodging_set.create(
            name='Tent',
            parent=lodging_root,
            visible=True,
        )

        cabins = [
            self.event.lodging_set.create(
                name=f'Cabin {i}',
                parent=cabin,
                visible=True,
            )
            for i in range(2)
        ]

        tent_areas = [
            self.event.lodging_set.create(
                name=f'Tent area {i}',
                parent=tent,
                visible=True,
            )
            for i in range(2)
        ]

        form_data = {
            **self.valid_form_data,
            'campers': [
                {
                    **self.valid_form_data['campers'][0],
                    'lodging': {
                        'lodging_requested': {
                            'choices': [cabin.id, cabins[0].id],
                            'id': cabins[0].id,
                        },
                    },
                },
                {
                    **self.valid_form_data['campers'][1],
                    'lodging': {
                        'lodging_requested': {
                            'choices': [tent.id, tent_areas[1].id],
                            'id': tent_areas[1].id,
                        },
                        'lodging_shared': True,
                        'lodging_shared_with': 'my buddy',
                        'lodging_comments': 'my buddy and me',
                    },
                },
            ],
        }

        self.assertEqual(models.Registration.objects.count(), 0)
        response = self.client.post(
            f'/api/events/{self.event.id}/register',
            {
                'formData': form_data,
                'pricingResults': {},
            },
            format='json'
        )
        self.assertEqual(response.status_code, 200)

        registrations = models.Registration.objects.all()
        registration = registrations[0]
        campers = registration.campers.all()

        self.assertEqual(campers[0].lodging_id, cabins[0].id)
        self.assertEqual(campers[0].lodging_shared, False)
        self.assertEqual(campers[0].lodging_shared_with, '')

        self.assertEqual(campers[1].lodging_id, tent_areas[1].id)
        self.assertEqual(campers[1].lodging_shared, True)
        self.assertEqual(campers[1].lodging_shared_with, 'my buddy')
        self.assertEqual(campers[1].lodging_comments, 'my buddy and me')

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
            invitation_email_template=(
                'Hi {{recipient_name}}, here is your link: {{{register_link}}}'),
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
        expected_link = (
            'http://testserver/events/'
            + str(self.event.id)
            + '/register?email=camper@example.com&code=abc123')
        self.assertEqual(message.body, f'Hi Campy McCampface, here is your link: {expected_link}')

        self.assertEqual(len(message.alternatives), 1)
        self.assertIsInstance(message.alternatives[0], tuple)
        self.assertEqual(message.alternatives[0][1], "text/html")

        self.maxDiff = None
        expected_link = expected_link.replace('&', '&amp;')
        expected_html = (
                '<p>Hi Campy McCampface, here is your link: <a href="'
                + expected_link + '">'
                + expected_link + '</a></p>\n')

        self.assertEqual(message.alternatives[0][0], expected_html)
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


class EventTests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser("tom", "tom@example.com", "password")
        self.client.login(username='tom', password='password')
        self.organization = models.Organization.objects.create(name='Test Organization')

    def test_event_create(self):
        response = self.client.post(
            '/api/events/',
            {
                'organization': self.organization.id,
                'name': 'Test Data Event',
                'registration_schema': {
                    'type': 'object',
                    'properties': {
                        'billing_name': {'type': 'string'},
                        'billing_address': {'type': 'string'},
                    },
                },
                'camper_schema': {
                    'type': 'object',
                    'properties': {
                        'name': {'type': 'string'},
                    },
                },
            },
            format='json'
        )

        self.assertEqual(response.status_code, 201, 'should return status code 201 on create')
        events = models.Event.objects.all().filter(id=response.data['id'])

        self.assertEqual(events.count(), 1, 'should only have the one event')


class LodgingSchemaTests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser("tom", "tom@example.com", "password")
        self.client.login(username='tom', password='password')
        self.organization = models.Organization.objects.create(name='Test Organization')

    def test_get(self):
        event = models.Event.objects.create(
            organization=self.organization,
            name='event to test lodgingschema endpoint',
        )
        event.lodging_set.create(
            name='Lodging',
            children_title='Please choose a lodging option',
            visible=True,
        )

        # lodging schema code is tested more thoroughly elsewhere
        response = self.client.get(f'/api/events/{event.id}/lodgingschema')
        self.assertIsInstance(response.data['lodging_schema'], dict)
        self.assertIsInstance(response.data['lodging_ui_schema'], dict)


class BulkEmailTests(APITestCase):
    # see also BulkEmailTests in test_mail.py

    def setUp(self):
        self.admin_user = User.objects.create_superuser("tom", "tom@example.com", "password")
        self.organization = models.Organization.objects.create(name='Test Organization')
        self.event = models.Event.objects.create(
            organization=self.organization,
            name='bulk email test event',
        )
        self.task = models.BulkEmailTask.objects.create(
            event=self.event,
            from_email='registration@example.com',
            subject='Hi, everyone!',
            body_template='Hi {{recipient.email}}',
        )
        self.task.recipients.create(email='alice@example.com')
        self.task.recipients.create(email='bob@example.com')

    def test_send(self):
        #  Test unauthenticated request
        response = self.client.post(f'/api/bulkemailtasks/{self.task.id}/send')
        self.assertEqual(response.status_code, 401)

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(f'/api/bulkemailtasks/{self.task.id}/send')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], self.task.id)
        self.assertIsNotNone(response.data['run_finish_time'])
        self.assertEqual([m.to[0] for m in mail.outbox], ['alice@example.com', 'bob@example.com'])

    def test_cancel(self):
        #  Test unauthenticated request
        response = self.client.post(f'/api/bulkemailtasks/{self.task.id}/cancel')
        self.assertEqual(response.status_code, 401)

        self.task.running_pid = 1234
        self.task.save()

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(f'/api/bulkemailtasks/{self.task.id}/cancel')

        self.assertEqual(response.status_code, 200)
        self.task.refresh_from_db()
        self.assertIsNone(self.task.running_pid)
