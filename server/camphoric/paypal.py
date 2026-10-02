'''
PayPal's Orders and Payments APIs (SPEC §9.7, DR-90). The server creates and
captures every order, and issues refunds; the browser only shows PayPal's
buttons and approval window.

Each call that changes something sends a `PayPal-Request-Id`, so a retried
call (a timeout, a double click) returns PayPal's first answer instead of
creating, capturing or refunding twice.
'''

import requests

TIMEOUT = 30  # seconds


class PayPalError(Exception):
    '''
    PayPal refused, or couldn't be reached. `unknown` is set when the call may
    have done what it was asked (a timeout, a server error), so it's not known
    whether money moved.
    '''

    def __init__(self, message, *, status=None, unknown=False, details=None, issue=None):
        super().__init__(message)
        self.status = status
        self.unknown = unknown
        self.details = details
        self.issue = issue


class PayPalClient:
    def __init__(self, base_url, client_id, secret):
        self.base_url = base_url
        self.client_id = client_id
        self.secret = secret
        self.session = requests.Session()
        self.session.auth = (self.client_id, self.secret)
        self.session.headers = {
            'Content-Type': 'application/json',
        }

    def _call(self, method, path, *, json=None, request_id=None):
        headers = {'Prefer': 'return=representation'}
        if request_id:
            headers['PayPal-Request-Id'] = request_id
        try:
            r = self.session.request(
                method, f'{self.base_url}{path}', json=json, headers=headers, timeout=TIMEOUT)
        except requests.Timeout as e:
            raise PayPalError(f'PayPal didn\'t answer in time ({e})', unknown=True)
        except requests.RequestException as e:
            raise PayPalError(f'Couldn\'t reach PayPal ({e})', unknown=True)
        try:
            body = r.json()
        except ValueError:
            body = None
        if r.status_code >= 500:
            raise PayPalError(f'PayPal had a problem (HTTP {r.status_code})',
                              status=r.status_code, unknown=True, details=body)
        if r.status_code >= 400:
            issue = None
            if isinstance(body, dict):
                for detail in body.get('details') or []:
                    issue = issue or detail.get('issue')
            message = (body or {}).get('message') if isinstance(body, dict) else None
            raise PayPalError(message or f'PayPal refused (HTTP {r.status_code})',
                              status=r.status_code, details=body, issue=issue)
        return body

    def fetch_order_details(self, order_id):
        return self._call('GET', f'/v2/checkout/orders/{order_id}')

    def create_order(self, body, request_id):
        return self._call('POST', '/v2/checkout/orders', json=body, request_id=request_id)

    def capture_order(self, order_id, request_id):
        return self._call(
            'POST', f'/v2/checkout/orders/{order_id}/capture', json={}, request_id=request_id)

    def refund_capture(self, capture_id, amount, note_to_payer, request_id):
        body = {'amount': {'value': amount, 'currency_code': 'USD'}}
        if note_to_payer:
            body['note_to_payer'] = note_to_payer[:255]
        return self._call(
            'POST', f'/v2/payments/captures/{capture_id}/refund', json=body,
            request_id=request_id)
