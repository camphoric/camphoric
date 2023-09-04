import json
import os.path
import copy
from camphoric import models


# TODO: it probably makes sense to subclass APITestCase and add this as a
# method so that some of these fixures can be easily created and accessible
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
        'registrant_email': 'testi@mctesterson.com',
        'campers': [
            {'name': 'Testi McTesterton'},
            {'name': 'Testi McTesterton Junior'},
        ],
        'billing_name': 'Testi McTesterton',
        'billing_address': '1234 Average Street',
    }


def create_registration(self, invitation=None):
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
    self.assertEqual(response.status_code, 200)
    registrations = models.Registration.objects.all()
    self.assertEqual(len(registrations), 1)
    registration = registrations[0]
    self.registration = registration
    with open(os.path.join(
        os.path.dirname(__file__),
        'data',
        'paypal_sample_order_details_response.json'
    )) as f:
        sample_order_details_response = json.load(f)

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
    self.campers = models.Camper.objects.all() \
        .filter(registration=self.registration.id)
