'''
Unsubscribing from an event's group email (SPEC §8.9, DR-48, DR-154): the
signed link (on to the client's page, and one-click POST), the page's endpoint,
skipping unsubscribed addresses, and the organizers' list.
'''

import os
import tempfile

from django.contrib.auth.models import User
from django.core import mail
from django.test import Client, TestCase, override_settings

from camphoric import models
from camphoric.mail import unsubscribe
from tests.test_group_email import GroupEmailTestCase


class TokenTests(TestCase):
    def test_round_trip_and_tampering(self):
        token = unsubscribe.make_token(7, 'Pat <Pat@Example.com>')
        self.assertEqual(unsubscribe.read_token(token), (7, 'pat@example.com'))
        with self.assertRaises(unsubscribe.signing.BadSignature):
            unsubscribe.read_token(token[:-2] + 'xx')

    def test_url_needs_a_base(self):
        self.assertEqual(unsubscribe.unsubscribe_url('', 7, 'a@x.org'), '')
        url = unsubscribe.unsubscribe_url('https://reg.camp.org', 7, 'a@x.org')
        self.assertTrue(url.startswith('https://reg.camp.org/api/unsubscribe/'))
        self.assertTrue(url.endswith('/'))


class UnsubscribeLinkTests(GroupEmailTestCase):
    '''The emailed link (DR-154): GET goes on to the client's page; POST is one-click.'''

    def setUp(self):
        super().setUp()
        self.client.logout()
        self.token = unsubscribe.make_token(self.event.id, 'Pat@Example.com')
        self.url = f'/api/unsubscribe/{self.token}/'

    def rows(self):
        return list(models.EmailUnsubscribe.objects.values_list('email', 'source'))

    def test_get_goes_to_the_client_page_and_changes_nothing(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response['Location'], f'/unsubscribe/{self.token}')
        self.assertEqual(response['X-Robots-Tag'], 'noindex')
        self.assertEqual(self.rows(), [])
        # A changed link goes on too: the page says what's wrong with it.
        response = self.client.get('/api/unsubscribe/a%3Cb%3E%3F/')
        self.assertEqual(response['Location'], '/unsubscribe/a%3Cb%3E%3F')

    def test_one_click_post(self):
        response = self.client.post(self.url, 'List-Unsubscribe=One-Click',
                                    content_type='application/x-www-form-urlencoded')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/json')
        self.assertEqual(response.json(), {
            'event': {'name': self.event.name}, 'address': 'pat@example.com',
            'unsubscribed': True})
        self.assertEqual(self.rows(), [('pat@example.com', 'link')])

    def test_one_click_post_with_a_bad_link(self):
        response = self.client.post(self.url[:-4] + 'zz/')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['code'], 'invalid')
        gone = f'/api/unsubscribe/{unsubscribe.make_token(99999, "pat@example.com")}/'
        self.assertEqual(self.client.post(gone).json()['code'], 'gone')
        self.assertEqual(self.rows(), [])


class UnsubscribePageServedTests(TestCase):
    def test_the_client_page_asks_not_to_be_indexed(self):
        with tempfile.TemporaryDirectory() as build:
            with open(os.path.join(build, 'index.html'), 'w') as f:
                f.write('<!doctype html>')
            with override_settings(REACT_BUILD_DIR=build):
                page = self.client.get('/unsubscribe/abc')
                other = self.client.get('/admin')
        self.assertEqual(page.status_code, 200)
        self.assertEqual(page['X-Robots-Tag'], 'noindex')
        self.assertNotIn('X-Robots-Tag', other)


class UnsubscribePageTests(GroupEmailTestCase):
    '''The client page's endpoint, /api/email/unsubscribe/<token> (DR-154).'''

    def setUp(self):
        super().setUp()
        self.client.logout()
        token = unsubscribe.make_token(self.event.id, 'Pat@Example.com')
        self.url = f'/api/email/unsubscribe/{token}'

    def rows(self):
        return list(models.EmailUnsubscribe.objects.values_list('email', 'source'))

    def test_get_describes_and_changes_nothing(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'event': {'name': self.event.name}, 'address': 'pat@example.com',
            'unsubscribed': False})
        self.assertEqual(response['X-Robots-Tag'], 'noindex')
        self.assertEqual(self.rows(), [])

    def test_confirming_unsubscribes_once(self):
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['unsubscribed'])
        self.client.post(self.url)
        self.assertEqual(self.rows(), [('pat@example.com', 'link')])
        # Visiting again says so.
        self.assertTrue(self.client.get(self.url).json()['unsubscribed'])

    def test_a_browser_gets_json_not_html(self):
        browser = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        response = self.client.get(self.url, HTTP_ACCEPT=browser)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/json')

    def test_only_this_events_list_counts(self):
        other = models.Event.objects.create(
            organization=self.event.organization, name='Another event')
        unsubscribe.unsubscribe(other, 'pat@example.com', source='admin')
        self.assertFalse(self.client.get(self.url).json()['unsubscribed'])

    def test_signed_in_needs_no_csrf_token(self):
        # The token is the permission; a signed-in organizer's session changes nothing.
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.admin)
        self.assertEqual(client.post(self.url).status_code, 200)

    def test_bad_links(self):
        response = self.client.get(self.url[:-2] + 'zz')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['code'], 'invalid')
        self.assertIn('incomplete or has been changed', response.json()['detail'])
        self.assertEqual(self.client.post(self.url[:-2] + 'zz').status_code, 400)
        gone = f'/api/email/unsubscribe/{unsubscribe.make_token(99999, "pat@example.com")}'
        response = self.client.get(gone)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['code'], 'gone')
        self.assertEqual(self.client.post(gone).status_code, 404)
        self.assertEqual(self.rows(), [])


class SkippingTests(GroupEmailTestCase):
    def test_copies_carry_the_link(self):
        keys = [f'camper:{self.made.c1.id}']
        self.assertEqual(self.send(keys).status_code, 202)
        [sent] = mail.outbox
        link = sent.extra_headers['List-Unsubscribe'][1:-1]
        self.assertTrue(link.startswith('http://testserver/api/unsubscribe/'))
        self.assertEqual(sent.extra_headers['List-Unsubscribe-Post'],
                         'List-Unsubscribe=One-Click')
        self.assertIn(link, sent.body)
        self.assertIn(link.replace('&', '&amp;'), sent.alternatives[0].content)
        # The link unsubscribes that recipient from this event.
        self.client.logout()
        self.client.post(link.replace('http://testserver', ''))
        self.assertTrue(models.EmailUnsubscribe.objects.filter(
            event=self.event, email='pat@example.com').exists())

    def test_unsubscribed_are_skipped(self):
        unsubscribe.unsubscribe(self.event, 'pat@example.com', source='admin')
        data = self.recipients(recipient_source='campers')
        self.assertNotIn('pat@example.com', [r['email'] for r in data['recipients']])
        self.assertIn(('unsubscribed', 'pat@example.com'),
                      [(s['reason'], s['email']) for s in data['skipped']])

    def test_unsubscribing_after_review_still_skips(self):
        keys = [f'camper:{self.made.c1.id}', f'camper:{self.made.c3.id}']
        unsubscribe.unsubscribe(self.event, 'PAT@example.com', source='link')
        batch = models.EmailBatch.objects.get(id=self.send(keys).data['id'])
        self.assertEqual([m.recipient_key for m in batch.messages.all()],
                         [f'camper:{self.made.c3.id}'])
        self.assertEqual([(s['reason'], s['key']) for s in batch.skipped],
                         [('unsubscribed', f'camper:{self.made.c1.id}')])

    def test_listed_addresses_too(self):
        unsubscribe.unsubscribe(self.event, 'kim@example.com', source='link')
        data = self.recipients(recipient_source='manual',
                               recipient_list='Kim <Kim@example.com>\nlou@example.com')
        self.assertEqual([r['email'] for r in data['recipients']], ['lou@example.com'])
        self.assertEqual([s['reason'] for s in data['skipped']], ['unsubscribed'])

    def test_other_events_and_other_email_are_unaffected(self):
        other = models.Event.objects.create(organization=self.event.organization, name='Other')
        unsubscribe.unsubscribe(other, 'pat@example.com', source='link')
        data = self.recipients(recipient_source='campers')
        self.assertIn('pat@example.com', [r['email'] for r in data['recipients']])


class AdminListTests(GroupEmailTestCase):
    def test_add_list_and_remove(self):
        url = '/api/emailunsubscribes/'
        response = self.client.post(url, {'event': self.event.id, 'email': ' Kim@Example.com '},
                                    format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data['email'], response.data['source'],
                          response.data['created_by_name']),
                         ('kim@example.com', 'admin', 'admin'))
        again = self.client.post(url, {'event': self.event.id, 'email': 'KIM@example.com'},
                                 format='json')
        self.assertEqual(again.status_code, 400)
        self.assertIn('already unsubscribed', str(again.data['email']))

        listed = self.client.get(url, {'event': self.event.id}).data
        self.assertEqual([row['email'] for row in listed], ['kim@example.com'])
        self.assertEqual(self.client.delete(f'{url}{listed[0]["id"]}/').status_code, 204)
        self.assertFalse(models.EmailUnsubscribe.objects.exists())

    def test_organizers_only(self):
        User.objects.create_user('camper', 'c@example.com', 'pw')
        self.client.force_authenticate(user=User.objects.get(username='camper'))
        self.assertEqual(self.client.get('/api/emailunsubscribes/').status_code, 403)
