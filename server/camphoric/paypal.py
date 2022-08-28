import requests


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

    def fetch_order_details(self, order_id):
        url = f'{self.base_url}/v2/checkout/orders/{order_id}'
        r = self.session.get(url)
        return r.json()
