from rest_framework.test import APITestCase

from camphoric import models, roles

from tests.factories import make_user


class ReportListTests(APITestCase):
    '''The reports API: its order and a report's category and description (#992).'''

    @classmethod
    def setUpTestData(cls):
        organization = models.Organization.objects.create(name='Org')
        cls.event = models.Event.objects.create(organization=organization, name='Camp')
        cls.admin = make_user(roles.ADMIN)

    def setUp(self):
        self.client.force_authenticate(user=self.admin)

    def titles(self):
        response = self.client.get('/api/reports/', {'event': self.event.id})
        self.assertEqual(response.status_code, 200)
        return [r['title'] for r in response.json()]

    def test_listed_by_title_ignoring_case(self):
        for title in ('rooming', 'Kitchen', 'balances', 'Arrivals'):
            models.Report.objects.create(event=self.event, title=title)
        self.assertEqual(self.titles(), ['Arrivals', 'balances', 'Kitchen', 'rooming'])

    def test_a_renamed_report_moves_to_its_new_place(self):
        models.Report.objects.create(event=self.event, title='Beta')
        renamed = models.Report.objects.create(event=self.event, title='Alpha')
        response = self.client.patch(
            f'/api/reports/{renamed.id}/', {'title': 'Zeta'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.titles(), ['Beta', 'Zeta'])

    def test_category_and_description_are_saved_and_returned(self):
        response = self.client.post('/api/reports/', {
            'event': self.event.id, 'title': 'Balances', 'template': 'x',
            'category': '  Finance ', 'description': 'What each family still owes.',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()['category'], 'Finance')
        self.assertEqual(response.json()['description'], 'What each family still owes.')

    def test_category_and_description_are_optional(self):
        response = self.client.post('/api/reports/', {
            'event': self.event.id, 'title': 'Roster', 'template': 'x',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()['category'], '')
        self.assertEqual(response.json()['description'], '')
