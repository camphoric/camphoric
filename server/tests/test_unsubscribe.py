'''
Unsubscribing from an event's group email (SPEC §8.9, DR-48): the signed link,
the public page and one-click POST, skipping unsubscribed addresses, and the
organizers' list.
'''

from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase

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


class UnsubscribePageTests(GroupEmailTestCase):
    def setUp(self):
        super().setUp()
        self.client.logout()
        self.url = f'/api/unsubscribe/{unsubscribe.make_token(self.event.id, "Pat@Example.com")}/'

    def rows(self):
        return list(models.EmailUnsubscribe.objects.values_list('email', 'source'))

    def test_get_asks_and_changes_nothing(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Unsubscribe?')
        self.assertContains(response, 'pat@example.com')
        self.assertContains(response, self.event.name)
        self.assertEqual(self.rows(), [])

    def test_confirming_unsubscribes_once(self):
        response = self.client.post(self.url)
        self.assertContains(response, 'You’re unsubscribed')
        self.client.post(self.url)
        self.assertEqual(self.rows(), [('pat@example.com', 'link')])
        # Visiting again says so.
        self.assertContains(self.client.get(self.url), 'You’re unsubscribed')

    def test_one_click_post(self):
        response = self.client.post(self.url, 'List-Unsubscribe=One-Click',
                                    content_type='application/x-www-form-urlencoded')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.rows(), [('pat@example.com', 'link')])

    def test_bad_links(self):
        response = self.client.post(self.url[:-4] + 'zz/')
        self.assertEqual(response.status_code, 400)
        self.assertContains(response, 'doesn’t work', status_code=400)
        gone = f'/api/unsubscribe/{unsubscribe.make_token(99999, "pat@example.com")}/'
        self.assertEqual(self.client.get(gone).status_code, 404)
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
