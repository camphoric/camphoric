'''
PayPal's replies, for the payment tests (SPEC §9.7). The server creates the
order, then fetches and captures it; these are the shapes it reads.
'''

ORDER_ID = '5O190127TN364715T'
CAPTURE_ID = '3C679366HH908993F'


def created(order_id=ORDER_ID):
    return {'id': order_id, 'status': 'CREATED'}


def order(registration, invoice, value, status='APPROVED', *, order_id=ORDER_ID,
          capture_id=CAPTURE_ID, source='paypal', capture_status='COMPLETED'):
    '''An order for the invoice, as PayPal returns it: approved, or captured.'''
    unit = {
        'reference_id': str(registration.uuid),
        'custom_id': f'invoice:{invoice.id}',
        'amount': {'currency_code': 'USD', 'value': f'{value:.2f}'},
    }
    if status == 'COMPLETED':
        unit['payments'] = {'captures': [{
            'id': capture_id, 'status': capture_status,
            'amount': {'currency_code': 'USD', 'value': f'{value:.2f}'},
        }]}
    return {
        'id': order_id,
        'status': status,
        'payment_source': {source: {}},
        'payer': {'name': {'given_name': 'John', 'surname': 'Doe'},
                  'email_address': 'customer@example.com'},
        'purchase_units': [unit],
    }


def captured(registration, invoice, value, **kwargs):
    return order(registration, invoice, value, 'COMPLETED', **kwargs)


def refund(refund_id='1JU08902781691411', value='10.00', status='COMPLETED'):
    return {'id': refund_id, 'status': status,
            'amount': {'currency_code': 'USD', 'value': value}}


class PayPalServerMixin:
    '''A mock PayPal for a test class: queue replies with `self.paypal.add_mock_response`.'''

    @classmethod
    def setUpClass(cls):
        from django.test import override_settings
        from camphoric.test.mock_server import MockServer

        super().setUpClass()
        cls.paypal = MockServer()
        cls.paypal.start()
        cls.addClassCleanup(cls.paypal.stop)
        cls.enterClassContext(override_settings(
            PAYPAL_BASE_URL=f'http://{cls.paypal.host}:{cls.paypal.port}',
            PAYPAL_SECRET='test-secret',
        ))

    def setUp(self):
        super().setUp()
        self.paypal.reset()

    def reply(self, *bodies, status=200):
        for body in bodies:
            self.paypal.add_mock_response(status, {}, body)
