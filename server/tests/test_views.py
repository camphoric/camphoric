from rest_framework.test import APITestCase


class RegisterTests(APITestCase):
	def test_hello(self):
		response = self.client.get('/api/register')
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data, {"hello": "world"})
