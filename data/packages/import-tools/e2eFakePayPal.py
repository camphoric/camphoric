'''
PayPal's Orders API, faked for an event's e2e tests (e2e-compose.yml runs it
on the app image's Python, as the server's PAYPAL_BASE_URL). Only the Python
standard library, so the image needs nothing more.

It creates the orders the server asks for and keeps what each asked, for the
tests to read (FakePayPal in e2ePayPal.ts):

    GET /e2e/orders         every order created, oldest first
    GET /e2e/orders/<id>    one, as {id, request_id, body}: body is the
                            request the server sent, its amounts as sent

No order is ever approved, so a capture is refused as PayPal refuses one the
payer hasn't approved, and nothing is paid.
'''

import itertools
import json
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

orders = {}  # id: {id, request_id, body}, in the order they were created
by_request_id = {}  # PayPal-Request-Id: order id (a retried create returns the first)
lock = threading.Lock()
numbers = itertools.count(1)

ORDER = re.compile(r'^/v2/checkout/orders/([A-Z0-9]+)$')
CAPTURE = re.compile(r'^/v2/checkout/orders/([A-Z0-9]+)/capture$')
RECORDED = re.compile(r'^/e2e/orders/([A-Z0-9]+)$')


def order_response(order):
    '''An order as PayPal returns it (Prefer: return=representation).'''
    body = order['body']
    return {
        'id': order['id'],
        'intent': body.get('intent'),
        'status': 'CREATED',
        'purchase_units': body.get('purchase_units', []),
        'links': [],
    }


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, data):
        payload = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def not_found(self):
        self.send_json(404, {'name': 'RESOURCE_NOT_FOUND', 'message': 'No such resource.'})

    def read_json(self):
        length = int(self.headers.get('Content-Length') or 0)
        if not length:
            return {}
        return json.loads(self.rfile.read(length))

    def do_GET(self):
        if self.path == '/health':
            return self.send_json(200, {'ok': True})
        if self.path == '/e2e/orders':
            with lock:
                return self.send_json(200, list(orders.values()))
        match = RECORDED.match(self.path) or ORDER.match(self.path)
        if match:
            with lock:
                order = orders.get(match.group(1))
            if order is None:
                return self.not_found()
            return self.send_json(200, order if self.path.startswith('/e2e/') else order_response(order))
        return self.not_found()

    def do_POST(self):
        if self.path == '/v2/checkout/orders':
            body = self.read_json()
            request_id = self.headers.get('PayPal-Request-Id')
            with lock:
                if request_id and request_id in by_request_id:
                    order = orders[by_request_id[request_id]]
                else:
                    order = {'id': f'E2EORDER{next(numbers):06d}', 'request_id': request_id, 'body': body}
                    orders[order['id']] = order
                    if request_id:
                        by_request_id[request_id] = order['id']
            return self.send_json(201, order_response(order))
        match = CAPTURE.match(self.path)
        if match:
            with lock:
                known = match.group(1) in orders
            if not known:
                return self.not_found()
            return self.send_json(422, {
                'name': 'UNPROCESSABLE_ENTITY',
                'message': 'The requested action could not be performed.',
                'details': [{
                    'issue': 'ORDER_NOT_APPROVED',
                    'description': 'The payer has not approved this order (a fake PayPal never does).',
                }],
            })
        return self.not_found()

    def log_message(self, format, *args):
        print(f'fake PayPal: {format % args}', flush=True)


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', 8000), Handler).serve_forever()
