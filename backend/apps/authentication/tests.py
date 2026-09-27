from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model

User = get_user_model()

class AuthTests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username='admin_test', 
            email='admin@test.com', 
            password='password123', 
            role='admin'
        )
        self.tech_user = User.objects.create_user(
            username='tech_test', 
            email='tech@test.com', 
            password='password123', 
            role='tech'
        )
        self.register_url = reverse('register')
        self.login_url = reverse('token')

    def test_registration_restricted_to_admin(self):
        data = {
            'username': 'new_farmer',
            'email': 'farmer@test.com',
            'password': 'password123',
            'role': 'farmer'
        }
        
        # Test anonymous
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        
        # Test non-admin
        self.client.force_authenticate(user=self.tech_user)
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Test admin
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.filter(username='new_farmer').count(), 1)

    def test_login_returns_user_details(self):
        data = {
            'username': 'tech_test',
            'password': 'password123'
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['username'], 'tech_test')
        self.assertEqual(response.data['user']['role'], 'tech')
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
