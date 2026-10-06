import datetime
from decimal import Decimal
import json

from django.test import SimpleTestCase, override_settings
from django.contrib.auth.models import User
from django.core import mail
import jsonschema  # Using Draft-7
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase, APIClient

from camphoric import models, serializers
from camphoric.lodging import LODGING_SCHEMA
from camphoric.test.mock_server import MockServer
from tests import paypal_mocks
from tests.factories import set_email


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


class VersionTests(APITestCase):
    def test_signed_out(self):
        response = self.client.get('/api/version')
        self.assertEqual(response.status_code, 401)

    @override_settings(CAMPHORIC_VERSION='0.12.0')
    def test_release(self):
        self.client.force_authenticate(User.objects.create_superuser('tom'))
        response = self.client.get('/api/version')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'version': '0.12.0'})

    @override_settings(CAMPHORIC_VERSION='')
    def test_not_a_release(self):
        self.client.force_authenticate(User.objects.create_superuser('tom'))
        response = self.client.get('/api/version')
        self.assertEqual(response.data, {'version': None})


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
            'registration_start': None,
            'registration_end': None,
            'time_zone': 'America/Los_Angeles',
        }])

    def test_excludes_events_closed_over_three_months_ago(self):
        today = datetime.datetime.now(datetime.timezone.utc)
        models.Event.objects.create(
            organization=self.organization,
            name='Recently Closed',
            registration_end=today - datetime.timedelta(days=30),
        )
        models.Event.objects.create(
            organization=self.organization,
            name='Long Closed',
            registration_end=today - datetime.timedelta(days=130),
        )

        response = self.client.get('/api/eventlist')
        self.assertEqual(response.status_code, 200)
        names = {event['name'] for event in response.data}
        # No close date and recently-closed events stay; long-closed drops off.
        self.assertIn('Test Data Event 1', names)
        self.assertIn('Recently Closed', names)
        self.assertNotIn('Long Closed', names)

    def test_includes_registration_times_and_the_time_zone(self):
        now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
        start = now - datetime.timedelta(days=10)
        end = now + datetime.timedelta(days=20)
        models.Event.objects.create(
            organization=self.organization,
            name='Dated Event',
            registration_start=start,
            registration_end=end,
            time_zone='America/New_York',
        )

        response = self.client.get('/api/eventlist')
        self.assertEqual(response.status_code, 200)
        dated = next(e for e in response.data if e['name'] == 'Dated Event')
        self.assertEqual(dated['registration_start'], start.isoformat())
        self.assertEqual(dated['registration_end'], end.isoformat())
        self.assertEqual(dated['time_zone'], 'America/New_York')


class RegisterGetTests(APITestCase):
    def setUp(self):
        self.organization = models.Organization.objects.create(name='Test Organization')

    def test_reg_close(self):
        event = models.Event.objects.create(
            organization=self.organization,
            name='Test Data Event',
            registration_end=datetime.datetime.now(datetime.timezone.utc) -
            datetime.timedelta(days=1),
        )

        response = self.client.get(f'/api/events/{event.id}/register')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['event']['is_open'], False)

    def test_registration_error_messages(self):
        messages = {
            'campers.*.lodging.lodging_requested.id': {
                'required': '{{camper}}: please finish choosing your lodging',
            },
            '*': {'required': '{{field}} is required'},
        }
        event = models.Event.objects.create(
            organization=self.organization,
            name='Test Error Messages Event',
            registration_error_messages=messages,
        )
        response = self.client.get(f'/api/events/{event.id}/register')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['registrationErrorMessages'], messages)

    def test_registration_error_messages_default_empty(self):
        event = models.Event.objects.create(
            organization=self.organization,
            name='Test No Error Messages Event',
        )
        response = self.client.get(f'/api/events/{event.id}/register')
        self.assertEqual(response.data['registrationErrorMessages'], {})

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
                    'pattern': r'^[a-zA-Z0-9_+\.-]+@([\w-]+\.)+[\w-]{2,4}$',
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
                            # an event may add to a lodging field the server configures
                            'lodging_comments': {
                                'ui:description': 'stuff about lodging comments',
                            },
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
        self.assertEqual(campers_ui['items']['lodging']['ui:description'], 'stuff about lodging')
        # The event's per-field additions merge with the server's widget settings.
        self.assertEqual(
            campers_ui['items']['lodging']['lodging_comments'],
            {
                'ui:widget': 'textarea',
                'ui:options': {'rows': 3, 'maxLength': 300},
                'ui:description': 'stuff about lodging comments',
            },
        )
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
                    'full': True,
                    'availability': 'auto',
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
                    'full': False,
                    'availability': 'auto',
                    'reserved': 0,
                    'sharing_multiplier': 1.0,
                    'visible': True}
            ]
        )

    def test_pricing_fields(self):
        event = models.Event.objects.create(
            organization=self.organization,
            name='Test Price Fields',
            start=datetime.datetime(2019, 2, 25, 17, 0, 5, tzinfo=datetime.timezone.utc),
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
        # Test without epayment_handling field
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
                'start': {'day': 25, 'month': 2, 'year': 2019, 'epoch': 1551052800.0},
                'is_open': True,
            }
        )
        self.assertEqual(response.data['payPalOptions'], {
            'clientId': 'test-client-id',
        })

        # Test with epayment_handling field
        event.epayment_handling = 2.5
        event.save()
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
                'start': {'day': 25, 'month': 2, 'year': 2019, 'epoch': 1551052800.0},
                'is_open': True,
                'epayment_handling': 2.50,
            }
        )
        self.assertEqual(response.data['payPalOptions'], {
            'clientId': 'test-client-id',
        })

    def test_invitation_code_overrides(self):
        event = models.Event.objects.create(
                organization=self.organization,
                name='Test Data Event 1',
                registration_schema={
                    'type': 'object',
                    'properties': {
                        'billing_name': {'type': 'string'},
                        'billing_address': {'type': 'string'},
                        },
                    },
                registration_ui_schema={
                    'ui:title': 'Test UI Schema',
                    'ui:description': 'Test Description',
                    },
                camper_schema={
                    'type': 'object',
                    'properties': {
                        'name': {'type': 'string'},
                        },
                    },
                )
        registration_type = models.RegistrationType.objects.create(
            event=event,
            name='worktrade',
            label="Work-trade",
            ui_schema_overrides={
                'ui:title': 'OVERRIDE',
                },
            camper_schema_overrides={
                'properties': {
                    'favorite_monkey': {'type': 'string'},
                    },
                },
            registration_schema_overrides={
                'properties': {
                    'campers': {
                        'maxItems': 1,
                        },
                    },
                },
            )
        invitation = models.Invitation.objects.create(
                registration_type=registration_type,
                recipient_name='Campy McCampface',
                recipient_email='camper@example.com',
                expiration_time=datetime.datetime(2100, 1, 1, 1, 0, 0, tzinfo=datetime.timezone.utc)
            )

        # good email/code
        response = self.client.get(
            f'/api/events/{event.id}/register?email=camper@example.com&code='
            + invitation.invitation_code)
        self.assertEqual(response.status_code, 200)
        # camper override
        prop_to_test = (response.data
                        ['dataSchema']['definitions']
                        ['camper']['properties']['favorite_monkey'])
        self.assertEqual({'type': 'string'}, prop_to_test,
                         "Should override camper properties")
        # registration override
        prop_to_test = response.data['dataSchema']['properties']['campers']['maxItems']
        self.assertEqual(1, prop_to_test,
                         "Should override registration properties")
        # uiSchema override
        prop_to_test = response.data['uiSchema']['ui:title']
        self.assertEqual('OVERRIDE', prop_to_test,
                         "Should override uiSchema properties")

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
            expiration_time=datetime.datetime(2100, 1, 1, 1, 0, 0, tzinfo=datetime.timezone.utc)
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
        invitation.expiration_time = datetime.datetime(
            2010, 1, 1, 1, 0, 0, tzinfo=datetime.timezone.utc)
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
        super().setUpClass()
        cls.paypal_server = MockServer()
        cls.paypal_server.start()
        cls.addClassCleanup(cls.paypal_server.stop)
        cls.enterClassContext(override_settings(
            PAYPAL_BASE_URL=f'http://{cls.paypal_server.host}:{cls.paypal_server.port}',
            PAYPAL_CLIENT_ID='test-client-id',
            PAYPAL_SECRET='test-secret',
        ))

    def setUp(self):
        create_standard_test_event(self)

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

        self.assertEqual({
            'registrationUUID': registration.uuid,
            'serverPricingResults': expected_pricing_results,
            'paymentOptions': {
                'title': 'Deposit',
                'description': '',
                'default': 'Full Payment',
                'options': [
                    {'name': 'Full Payment', 'title': 'Full Payment', 'amount': 300.0,
                     'handling': 0.0},
                    {'name': '50% Deposit', 'title': '50% Deposit', 'amount': 200.0,
                     'handling': 0.0},
                ],
            },
            'handlingPercent': None,
        }, response.data)

        #
        # The PayPal button: the registration is completed, unpaid, and the
        # server creates the PayPal order for its invoice (SPEC DR-90, DR-91).
        #

        self.paypal_server.add_mock_response(200, {}, paypal_mocks.created())
        response = self.client.post(
            f'/api/events/{self.event.id}/register',
            {
                'registrationUUID': registration.uuid,
                'step': 'paypal-order',
                'paymentType': 'PayPal',
                'paymentOption': 'Full Payment',
            },
            format='json'
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['orderID'], paypal_mocks.ORDER_ID)
        self.assertEqual((response.data['total'], response.data['handling']), (300.0, 0.0))
        registration.refresh_from_db()
        self.assertTrue(registration.completed)
        self.assertIsNotNone(registration.completed_at)
        invoice = registration.invoices.get()
        self.assertEqual((invoice.origin, invoice.description, invoice.amount),
                         ('registration', 'Full Payment', Decimal('300.00')))
        self.assertEqual(invoice.pending_paypal_order_id, paypal_mocks.ORDER_ID)
        [create] = self.paypal_server.requests
        self.assertEqual(create['path_query'], '/v2/checkout/orders')
        unit = create['json']['purchase_units'][0]
        text = f'Total for Invoice #{invoice.id} for Test Registration Event'
        self.assertEqual(unit['description'], text)
        self.assertEqual(unit['items'], [{
            'name': text, 'quantity': '1',
            'unit_amount': {'currency_code': 'USD', 'value': '300.00'}}])
        self.assertEqual(unit['amount']['value'], '300.00')
        self.assertEqual(unit['reference_id'], str(registration.uuid))
        self.assertEqual(unit['custom_id'], f'invoice:{invoice.id}')
        self.assertEqual(mail.outbox, [])  # not until the flow ends

        #
        # Approved: the server checks the order and captures it.
        #

        self.paypal_server.reset()
        self.paypal_server.add_mock_response(
            200, {}, paypal_mocks.order(registration, invoice, 300))
        captured = paypal_mocks.captured(registration, invoice, 300)
        self.paypal_server.add_mock_response(201, {}, captured)
        response = self.client.post(
            f'/api/events/{self.event.id}/register',
            {
                'registrationUUID': registration.uuid,
                'step': 'payment',
                'paymentType': 'PayPal',
                'paypalOrderId': paypal_mocks.ORDER_ID,
            },
            format='json'
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['confirmationPage'],
                         '# Thanks! You owe $300.00, paid by PayPal.')
        self.assertFalse(response.data['emailError'])
        self.assertEqual(response.data['serverPricingResults'], expected_pricing_results)
        self.assertEqual(response.data['invoice']['status'], 'paid')
        self.assertEqual(response.data['ledger']['balance'], 0)
        self.assertEqual(self.paypal_server.requests[1]['path_query'],
                         f'/v2/checkout/orders/{paypal_mocks.ORDER_ID}/capture')

        [payment] = registration.payment_set.all()
        self.assertEqual(payment.invoice, invoice)
        self.assertEqual(payment.paypal_response, captured)
        self.assertEqual(payment.paypal_transaction_id, paypal_mocks.CAPTURE_ID)
        self.assertEqual(payment.amount, 300)
        self.assertEqual(payment.payment_type, 'PayPal')
        self.assertEqual(payment.notes, 'Initial payment')
        invoice.refresh_from_db()
        self.assertIsNone(invoice.pending_paypal_order_id)

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

Total: $300


Due now: $300.00""".lstrip())
        self.assertEqual(len(message.alternatives), 1)
        self.assertIsInstance(message.alternatives[0], tuple)
        self.assertEqual(message.alternatives[0][1], "text/html")
        self.assertIn("<p>Due now: $300.00</p>", message.alternatives[0][0])

        self.assertEqual(message.from_email, 'reg@camp.org')
        self.assertEqual(message.to, ['testi-test@mctesterson.com'])

        # A repeated payment step (a retry, a double click) records no second
        # payment and sends no second confirmation: PayPal says it's captured.
        self.paypal_server.reset()
        self.paypal_server.add_mock_response(200, {}, captured)
        repeat = self.client.post(
            f'/api/events/{self.event.id}/register',
            {
                'registrationUUID': registration.uuid,
                'step': 'payment',
                'paymentType': 'PayPal',
                'paypalOrderId': paypal_mocks.ORDER_ID,
            },
            format='json'
        )
        self.assertEqual(repeat.status_code, 200, repeat.data)
        self.assertEqual(repeat.data['confirmationPage'], response.data['confirmationPage'])
        self.assertEqual(registration.payment_set.count(), 1)
        self.assertEqual(len(mail.outbox), 1)

    def test_post_enforces_dependencies(self):
        # Event schemas are Draft 7, as the browser validates them; newer drafts
        # drop `dependencies`, which events use for their conditional fields.
        self.event.camper_schema = {
            **self.event.camper_schema,
            'dependencies': COOLNESS_DEPENDENCIES,
        }
        self.event.save()
        first, *rest = self.valid_form_data['campers']

        def post(camper):
            return self.client.post(
                f'/api/events/{self.event.id}/register',
                {
                    'formData': {**self.valid_form_data, 'campers': [camper, *rest]},
                    'pricingResults': {},
                },
                format='json',
            )

        response = post({**first, 'is_really_cool': True})
        self.assertEqual(response.status_code, 400)
        self.assertIn('campers.0', response.data)

        response = post({**first, 'is_really_cool': True, 'coolness': 11})
        self.assertEqual(response.status_code, 200)

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

    def test_post_deposit(self):
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
        self.assertEqual(response.data['paymentOptions']['options'][1]['amount'], 200)

        #
        # payment step: by check, the deposit. The invoice waits for the check.
        #
        response = self.client.post(
            f'/api/events/{self.event.id}/register',
            {
                'registrationUUID': registration.uuid,
                'step': 'payment',
                'paymentType': 'Check',
                'paymentOption': '50% Deposit',
            },
            format='json'
        )
        self.assertEqual(response.status_code, 200)
        invoice = registration.invoices.get()
        self.assertEqual((invoice.description, invoice.amount, invoice.payment_type,
                          invoice.status), ('50% Deposit', Decimal('200.00'), 'Check', 'open'))
        self.assertFalse(registration.payment_set.exists())
        self.assertEqual(response.data['ledger']['balance'], 300)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]

        self.assertEqual(message.body, """
Thanks for registering, Testi McTesterton!

Campers:
| Name | Total |
| ---- | ----- |
| Testi McTesterton | 100 |
| Testi McTesterton Junior | 100 |

Total: $300


Due now: $200.00""".lstrip())
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
<p>Total: $300</p>
<p>Due now: $200.00</p>
""".lstrip())

    def test_post_email_templates(self):
        event = models.Event(
            organization=self.organization,
            epayment_handling=2.5,
            name="Test Registration Event",
            pricing={"cabin": 99},
            registration_pricing_logic=[
                {
                    "label": "Random",
                    "var": "random",
                    "exp": "bobby flay",
                    },
                {
                    "label": "Cabins",
                    "var": "cabins",
                    "exp": {
                        "*": [
                            {"var": "pricing.cabin"},
                            1.033,
                            ]
                        },
                    },
                {
                    "label": "Total",
                    "var": "total",
                    "exp": {
                        "+": [
                            {"var": "cabins"},
                            ]
                        },
                    },
                ],
            camper_pricing_logic=[],
            registration_deposit_schema=self.event.registration_deposit_schema,
            confirmation_email_from='reg@camp.org',
        )
        event.save()
        set_email(event.confirmation_template, 'Registration confirmation', ''.join([
            '- handling:{{ pricing.handling }}\n',
            '- cabins: {{ pricing.cabins }}\n',
            '- total: {{ pricing.total }}\n',
            '- Initial Payment: {{ initial_payment.type }}\n',
            '- **Amount you are paying now: {{ initial_payment.total }}**\n',
            '- Due by June 20th: {{ initial_payment.balance }}\n',
            '- Your total: {{ pricing.total }}',
        ]))
        self.maxDiff = None
        expected_pricing_results = {
            "campers": [{}],
            "cabins": 102.27,
            "random": "bobby flay",
            "total": 102.27,
        }

        #
        # registration step
        #
        response = self.client.post(
            f'/api/events/{event.id}/register',
            {
                'formData': {'registrant_email': 'joe@blow.org', 'campers': [{}]},
                'pricingResults': expected_pricing_results,
            },
            format='json'
        )

        self.assertEqual(response.status_code, 200, response.data)
        registrations = models.Registration.objects.all()
        self.assertEqual(len(registrations), 1)
        registration = registrations[0]
        self.assertEqual(response.data['registrationUUID'], registration.uuid)
        self.assertEqual(response.data['serverPricingResults'], expected_pricing_results)
        # The fee if paid online, on each option's own amount (SPEC DR-88).
        self.assertEqual(response.data['handlingPercent'], 2.5)
        self.assertEqual(
            [(o['name'], o['amount'], o['handling'])
             for o in response.data['paymentOptions']['options']],
            [('Full Payment', 102.27, 2.56), ('50% Deposit', 102.27, 2.56)])

        #
        # payment step
        #
        response = self.client.post(
            f'/api/events/{event.id}/register',
            {
                'registrationUUID': registration.uuid,
                'step': 'payment',
                'paymentType': 'Check',
                'paymentOption': '50% Deposit',
            },
            format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]

        # The fee isn't part of the price any more: paying by check, there's none.
        self.assertEqual("""
- handling:
- cabins: 102.27
- total: 102.27
- Initial Payment: 50% Deposit
- **Amount you are paying now: 102.27**
- Due by June 20th: 0.00
- Your total: 102.27""".lstrip(), message.body)


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
        )
        set_email(registration_type.invitation_template, 'Invitation to register', (
            'Hi {{ invitation.recipient_name or invitation.recipient_email }}, '
            'here is your link: {{ invitation.register_url }}'))
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
    '''The basics of /api/users/; test_users_api.py covers the rest.'''

    def setUp(self):
        self.admin_user = User.objects.create_superuser("tom", "tom@example.com", "password")
        self.client.login(username='tom', password='password')

    def test_list_unauthorized(self):
        # User management is hidden from anyone who isn't an Admin (SPEC DR-50).
        self.client.logout()
        response = self.client.get('/api/users/')
        self.assertEqual(response.status_code, 404)

    def test_list_authorized(self):
        response = self.client.get('/api/users/')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['username'], 'tom')
        self.assertEqual(response.data[0]['role'], 'admin')
        self.assertNotIn('password', response.data[0])

    def test_create(self):
        response = self.client.post(
            '/api/users/',
            {'username': 'jerry', 'email': 'jerry@example.com', 'role': 'registrar',
             'send_password_link': False},
            format='json'
        )

        self.assertEqual(response.status_code, 201, response.data)
        user = User.objects.get(username='jerry')
        self.assertFalse(user.has_usable_password())
        self.assertEqual(len(User.objects.all()), 2)

    def test_edit(self):
        user = User.objects.create_user(username='jerry', email='jerry@example.com')

        response = self.client.patch(
            f'/api/users/{user.id}/', {'email': 'jerry@example.org'}, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(User.objects.get(username='jerry').email, 'jerry@example.org')

    def test_delete(self):
        user = User.objects.create_user(username='jerry')

        response = self.client.delete(f'/api/users/{user.id}/')
        self.assertEqual(response.status_code, 204)

        with self.assertRaises(User.DoesNotExist):
            User.objects.get(id=user.id)


class PriceAutoUpdateTests(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.paypal_server = MockServer()
        cls.paypal_server.start()
        cls.addClassCleanup(cls.paypal_server.stop)
        cls.enterClassContext(override_settings(
            PAYPAL_BASE_URL=f'http://{cls.paypal_server.host}:{cls.paypal_server.port}',
            PAYPAL_CLIENT_ID='test-client-id',
            PAYPAL_SECRET='test-secret',
        ))

    def setUp(self):
        self.admin_user = User.objects.create_superuser("tom", "tom@example.com", "password")
        self.client.login(username='tom', password='password')
        create_standard_test_event(self, 'Test Registration Org', 'Test Registration Event')

    def createRegistration(self, invitation=None, payment_type='PayPal'):
        invitation_info = {}

        if invitation:
            invitation_info = {
                'invitation': {
                    'recipient_email': invitation.recipient_email,
                    'invitation_code': invitation.invitation_code,
                },
            }

        response = self.client.post(
            f'/api/events/{self.event.id}/register',
            {
                'formData': self.valid_form_data,
                'pricingResults': {},
                **invitation_info,
            },
            format='json'
        )

        self.assertEqual(response.status_code, 200, msg=response.data)
        registrations = models.Registration.objects.all()
        self.assertEqual(len(registrations), 1)
        registration = registrations[0]
        self.registration = registration
        if payment_type == 'PayPal':
            self.paypal_server.reset()
            self.paypal_server.add_mock_response(200, {}, paypal_mocks.created())
            response = self.client.post(f'/api/events/{self.event.id}/register', {
                'registrationUUID': registration.uuid, 'step': 'paypal-order',
                'paymentType': payment_type}, format='json')
            self.assertEqual(response.status_code, 200, msg=response.data)
            invoice = registration.invoices.get()
            value = response.data['total']
            self.paypal_server.add_mock_response(
                200, {}, paypal_mocks.order(registration, invoice, value))
            self.paypal_server.add_mock_response(
                201, {}, paypal_mocks.captured(registration, invoice, value))
            body = {'paypalOrderId': paypal_mocks.ORDER_ID}
        else:
            body = {}
        response = self.client.post(
            f'/api/events/{self.event.id}/register',
            {
                'registrationUUID': registration.uuid,
                'step': 'payment',
                'paymentType': payment_type,
                **body,
            },
            format='json'
        )
        self.assertEqual(response.status_code, 200, msg=response.data)
        self.registration.refresh_from_db()
        self.campers = models.Camper.objects.all() \
            .filter(registration=self.registration.id)

    def test_camper_edit(self):
        self.createRegistration()

        # assert pricing is correct before price change
        self.assertEqual(
            self.registration.server_pricing_results['total'],
            300,
            'pricing before should be ok',
        )
        response = self.client.patch(
            f'/api/campers/{self.campers[0].id}/',
            {
                'attributes': {
                    'is_really_cool': True,
                },
            },
            format='json'
        )
        self.assertEqual(response.status_code, 200)
        response = self.client.patch(
            f'/api/campers/{self.campers[1].id}/',
            {
                'attributes': {
                    'is_really_cool': True,
                },
            },
            format='json'
        )
        self.assertEqual(response.status_code, 200)

        self.registration.refresh_from_db()
        self.assertEqual(
            self.registration.server_pricing_results['total'],
            100,
            'pricing after should be ok',
        )

    def test_registration_edit(self):
        self.createRegistration()

        # assert pricing is correct before price change
        self.assertEqual(
            self.registration.server_pricing_results['total'],
            300,
            'pricing before should be ok',
        )
        self.assertEqual(
            self.registration.registration_type,
            None,
            'registration_type before should be ok',
        )

        response = self.client.patch(
            f'/api/registrations/{self.registration.id}/',
            {
                'registration_type': self.registration_type.id,
            },
        )

        self.registration.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data['id'],
            self.registration.id,
            'registration patch response should be ok',
        )
        self.assertEqual(
            self.registration.registration_type.id,
            self.registration_type.id,
            'registration_type after should be ok',
        )

        self.assertEqual(
            self.registration.server_pricing_results['total'],
            200,
            'pricing after should be ok',
        )

    def make_cool(self):
        for camper in self.campers:
            response = self.client.patch(
                f'/api/campers/{camper.id}/', {'attributes': {'is_really_cool': True}},
                format='json')
            self.assertEqual(response.status_code, 200)
        self.registration.refresh_from_db()
        return self.registration.server_pricing_results

    def test_the_handling_fee_paid_online_stays_on_its_invoice(self):
        # SPEC DR-88: the fee is the invoice's, so later price changes leave it be.
        self.event.epayment_handling = 2.5
        self.event.save()
        self.createRegistration()
        results = self.registration.server_pricing_results
        self.assertNotIn('handling', results)
        self.assertEqual(results['total'], 300)
        invoice = self.registration.invoices.get()
        self.assertEqual((invoice.amount, invoice.handling), (Decimal('300.00'),
                                                              Decimal('7.50')))
        self.assertFalse(self.registration.pricing_overrides.exists())

        # A discount later leaves the fee as it was charged; the registration
        # is now owed back what it overpaid.
        results = self.make_cool()
        self.assertEqual(results['total'], 100)
        invoice.refresh_from_db()
        self.assertEqual(invoice.handling, Decimal('7.50'))
        from camphoric import invoices
        ledger = invoices.ledger(self.registration)
        self.assertEqual((ledger.total_owed, ledger.total_paid, ledger.balance),
                         (Decimal('107.50'), Decimal('307.50'), Decimal('-200.00')))

    def test_paying_by_check_has_no_fee(self):
        self.event.epayment_handling = 2.5
        self.event.save()
        self.createRegistration(payment_type='Check')
        self.assertFalse(self.registration.pricing_overrides.exists())
        self.assertNotIn('handling', self.registration.server_pricing_results)
        self.assertEqual(self.registration.invoices.get().handling, Decimal('0.00'))


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


# TODO: it probably makes sense to subclass APITestCase and add this as a
# method so that some of these fixures can be easily created and accessible
# A conditional field: a really cool camper must say how cool.
COOLNESS_DEPENDENCIES = {
    'is_really_cool': {
        'oneOf': [
            {'properties': {'is_really_cool': {'enum': [False]}}},
            {
                'properties': {
                    'is_really_cool': {'enum': [True]},
                    'coolness': {'type': 'integer'},
                },
                'required': ['coolness'],
            },
        ],
    },
}


class ValidateAttributesTests(SimpleTestCase):
    '''Admin edits validate attributes as Draft 7, like the registration form.'''

    SCHEMA = {
        'type': 'object',
        'properties': {'is_really_cool': {'type': 'boolean'}},
        'dependencies': COOLNESS_DEPENDENCIES,
    }

    def test_enforces_dependencies(self):
        with self.assertRaises(ValidationError):
            serializers.validate_attributes({'attributes': {'is_really_cool': True}}, self.SCHEMA)

        data = {'attributes': {'is_really_cool': True, 'coolness': 11}}
        self.assertEqual(serializers.validate_attributes(data, self.SCHEMA), data)


def create_standard_test_event(
    self,
    org_name='Test Organization',
    event_name='Test Registration Event'
):
    self.organization = models.Organization.objects.create(name=org_name)
    self.event = models.Event.objects.create(
        organization=self.organization,
        name=event_name,
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
                'is_really_cool': {'type': 'boolean'},
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
                'exp': {
                    'if': [
                        {'==': [
                            {'var': 'camper.is_really_cool'},
                            True,
                        ]},
                        0,
                        100,
                    ],
                },
            },
            {
                'var': 'total',
                'exp': {'var': 'tuition'},
            },
        ],
        registration_deposit_schema={
            'enum': [
                '{"name":"Full Payment","logic":{"var":["total"]}}',
                '{"name":"50% Deposit","logic":{"-":[{"var":["total"]},{"*":[{"var":["tuition",0]},0.5]}]}}',  # noqa: E501
                ],
            'type': 'string',
            'title': 'Deposit',
            'default': '{"name":"Full Payment","logic":{"var":["total"]}}',
            'enumNames': [
                'Full Payment',
                '50% Deposit',
                ],
        },
        confirmation_page_template=(
            '# Thanks! You owe {{ pricing.total | money }}, '
            'paid by {{ registration.payment_type }}.'),
        confirmation_email_from='reg@camp.org',
        paypal_client_id='test-client-id',
    )
    set_email(self.event.confirmation_template, 'Registration confirmation', ''.join([
        'Thanks for registering, {{ registration.attributes.billing_name }}!\n',
        '\nCampers:\n',
        '| Name | Total |\n',
        '| ---- | ----- |\n',
        '{% for camper in campers %}',
        '| {{ camper.attributes.name }} | {{ camper.pricing.total }} |\n',
        # Mustache dropped the line its {{/campers}} stood alone on.
        '{% endfor %}',
        '\nTotal: ${{ pricing.total }}\n',
        '\n\nDue now: ${{ initial_payment.total }}\n',
    ]))
    self.registration_type = models.RegistrationType.objects.create(
        event=self.event,
        name='worktrade',
        label="Work-trade"
    )
    self.invitation = models.Invitation.objects.create(
        registration_type=self.registration_type,
        recipient_email='camper@example.com',
    )
    self.valid_form_data = {
        'registrant_email': 'testi-test@mctesterson.com',
        'campers': [
            {'name': 'Testi McTesterton'},
            {'name': 'Testi McTesterton Junior'},
        ],
        'billing_name': 'Testi McTesterton',
        'billing_address': '1234 Average Street',
    }


class EventPricingLogicValidationTests(APITestCase):
    '''Camper and registration pricing logic must have a `total` (SPEC DR-69).'''

    FIELDS = ['camper_pricing_logic', 'registration_pricing_logic']

    def setUp(self):
        self.admin_user = User.objects.create_superuser("tom", "tom@example.com", "password")
        self.client.force_authenticate(user=self.admin_user)
        self.organization = models.Organization.objects.create(name='Test Organization')
        self.event = models.Event.objects.create(
            organization=self.organization,
            name='Test Event',
        )

    def patch(self, field, value):
        return self.client.patch(
            f'/api/events/{self.event.id}/', {field: value}, format='json')

    def test_accepts_logic_with_a_total(self):
        value = [
            {'var': 'tuition', 'label': 'Tuition', 'exp': 200},
            {'var': 'total', 'label': 'Total', 'exp': {'var': 'tuition'}},
        ]
        for field in self.FIELDS:
            with self.subTest(field=field):
                response = self.patch(field, value)
                self.assertEqual(response.status_code, 200, response.data)
                self.event.refresh_from_db()
                self.assertEqual(getattr(self.event, field), value)

    def test_rejects_logic_without_a_total(self):
        for value in [
            [],
            [{'var': 'tuition', 'exp': 200}],
            {'var': 'total', 'exp': 200},
            [{'var': 'total'}],
            [{'exp': 200}, {'var': 'total', 'exp': 200}],
            ['total'],
        ]:
            for field in self.FIELDS:
                with self.subTest(field=field, value=value):
                    response = self.patch(field, value)
                    self.assertEqual(response.status_code, 400, response.data)
                    self.assertIn(field, response.data)

    def test_creating_an_event_checks_it_too(self):
        response = self.client.post('/api/events/', {
            'organization': self.organization.id,
            'name': 'No Total',
            'camper_pricing_logic': [{'var': 'tuition', 'exp': 200}],
            'registration_pricing_logic': [{'var': 'total', 'exp': 0}],
        }, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(list(response.data), ['camper_pricing_logic'])


class EventErrorMessagesValidationTests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser("tom", "tom@example.com", "password")
        self.client.force_authenticate(user=self.admin_user)
        self.organization = models.Organization.objects.create(name='Test Organization')
        self.event = models.Event.objects.create(
            organization=self.organization,
            name='Test Event',
        )

    def patch(self, value):
        return self.client.patch(
            f'/api/events/{self.event.id}/',
            {'registration_error_messages': value},
            format='json',
        )

    def test_accepts_path_keyword_message_map(self):
        value = {
            'campers.*.phone': {'pattern': '{{camper}}: enter a phone number'},
            '*': {'required': '{{field}} is required'},
        }
        response = self.patch(value)
        self.assertEqual(response.status_code, 200, response.data)
        self.event.refresh_from_db()
        self.assertEqual(self.event.registration_error_messages, value)

    def test_accepts_empty(self):
        response = self.patch({})
        self.assertEqual(response.status_code, 200, response.data)

    def test_rejects_malformed(self):
        for value in [
            ['not', 'an', 'object'],
            {'campers.*.phone': 'not an object'},
            {'campers.*.phone': {'pattern': 42}},
            {'campers.*.phone': {'pattern': '   '}},
            {'   ': {'required': 'blank path'}},
            {'campers.*.phone': {'': 'blank keyword'}},
        ]:
            with self.subTest(value=value):
                response = self.patch(value)
                self.assertEqual(response.status_code, 400, response.data)
                self.assertIn('registration_error_messages', response.data)
