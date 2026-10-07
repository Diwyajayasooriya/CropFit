from datetime import timedelta
import time
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from apps.greenhouses.models.models import GreenHouse
from apps.node.models.nodeDetails.models import Node
from apps.node.models.actuators.models import Actuator, ActuatorCommand
from apps.conditions.models.models import Condition, ConditionReading
from apps.alerts.models import Alert


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class FarmerFlowTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username='owner', email='owner@example.test', password='test-password', role='farmer')
        self.other = User.objects.create_user(username='other', email='other@example.test', password='test-password', role='farmer')
        self.gh = GreenHouse.objects.create(user=self.owner, name='Farm A', location='A', crop='Tomato')
        self.foreign = GreenHouse.objects.create(user=self.other, name='Farm B', location='B', crop='Chilli')
        self.node = Node.objects.create(greenHouse=self.gh, node_id='GN-A', node_name='Hub A', is_claimed=True)
        self.node.set_hub_token('test-hub-token-a')
        self.node.save()
        self.other_node = Node.objects.create(greenHouse=self.foreign, node_id='GN-B', node_name='Hub B', is_claimed=True)
        self.other_node.set_hub_token('test-hub-token-b')
        self.other_node.save()
        self.actuator = Actuator.objects.create(node=self.node, actuator_id='fan-a', actuator_type='fan', is_active=False)
        self.client = APIClient()
        self.client.force_authenticate(self.owner)
        self.edge = APIClient()
        self.edge.credentials(HTTP_AUTHORIZATION='Bearer test-hub-token-a')

    def request_command(self):
        return self.client.post(f'/api/v1/nodes/actuators/{self.actuator.id}/command/', {'action': 'ON'}, format='json')

    def test_queue_acceptance_does_not_change_hardware_state(self):
        response = self.request_command()
        self.assertEqual(response.status_code, 202)
        self.actuator.refresh_from_db()
        self.assertFalse(self.actuator.is_active)
        self.assertIsNone(self.actuator.confirmed_at)
        self.assertEqual(self.request_command().status_code, 409)

    def test_poll_ack_and_duplicate_ack(self):
        command_id = self.request_command().data['id']
        polled = self.edge.get('/api/v1/nodes/commands/poll/')
        self.assertEqual(polled.status_code, 200)
        self.assertEqual(polled.data['commands'][0]['id'], command_id)
        self.assertEqual(self.edge.get('/api/v1/nodes/commands/poll/').data['commands'][0]['id'], command_id)
        body = {'command_id': command_id, 'status': 'confirmed', 'is_active': True}
        self.assertEqual(self.edge.post('/api/v1/nodes/commands/ack/', body, format='json').status_code, 200)
        self.assertEqual(self.edge.post('/api/v1/nodes/commands/ack/', body, format='json').status_code, 200)
        self.actuator.refresh_from_db()
        self.assertTrue(self.actuator.is_active)
        self.assertIsNotNone(self.actuator.confirmed_at)
        self.assertEqual(self.edge.get('/api/v1/nodes/commands/poll/').data['commands'], [])

    def test_other_hub_cannot_receive_or_ack_command(self):
        command_id = self.request_command().data['id']
        self.edge.credentials(HTTP_AUTHORIZATION='Bearer test-hub-token-b')
        self.assertEqual(self.edge.get('/api/v1/nodes/commands/poll/').data['commands'], [])
        result = self.edge.post('/api/v1/nodes/commands/ack/', {'command_id': command_id, 'status': 'confirmed', 'is_active': True}, format='json')
        self.assertEqual(result.status_code, 404)

    def test_command_and_status_are_owner_scoped(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.request_command().status_code, 404)
        self.assertEqual(self.client.get(f'/api/v1/nodes/actuators/{self.actuator.id}/command-status/').status_code, 404)
        self.assertEqual(ActuatorCommand.objects.count(), 0)

    def test_wrong_ack_does_not_confirm(self):
        command_id = self.request_command().data['id']
        result = self.edge.post('/api/v1/nodes/commands/ack/', {'command_id': command_id, 'status': 'confirmed', 'is_active': False}, format='json')
        self.assertEqual(result.status_code, 400)
        self.actuator.refresh_from_db()
        self.assertFalse(self.actuator.is_active)

    def test_expired_command_cannot_change_state(self):
        command_id = self.request_command().data['id']
        ActuatorCommand.objects.filter(pk=command_id).update(expires_at=timezone.now() - timedelta(seconds=1))
        result = self.edge.post('/api/v1/nodes/commands/ack/', {'command_id': command_id, 'status': 'confirmed', 'is_active': True}, format='json')
        self.assertEqual(result.data['status'], 'expired')
        self.actuator.refresh_from_db()
        self.assertFalse(self.actuator.is_active)
        self.assertEqual(self.request_command().status_code, 202)

    def test_anonymous_device_endpoints_reject_access(self):
        self.edge.credentials()
        self.assertEqual(self.edge.get('/api/v1/nodes/commands/poll/').status_code, 403)
        self.assertEqual(self.edge.get('/api/v1/nodes/nodes/config/?node_id=GN-A').status_code, 401)

    def test_hub_token_fetches_config_and_heartbeat(self):
        self.assertEqual(self.edge.get('/api/v1/nodes/nodes/config/?node_id=GN-A').status_code, 200)
        self.assertEqual(self.edge.post('/api/v1/nodes/heartbeat/', {'device_id': 'GN-A', 'uptime_seconds': 42}, format='json').status_code, 200)
        self.node.refresh_from_db()
        self.assertTrue(self.node.is_online)

    def test_claim_prevents_foreign_greenhouse_and_returns_lockout_seconds(self):
        node = Node.objects.create(node_id='GN-NEW', node_name='New', claim_code='ABC123', claim_locked_until=timezone.now() + timedelta(seconds=120))
        body = {'device_id': node.node_id, 'claim_code': 'ABC123', 'greenhouse_id': self.foreign.id}
        self.assertEqual(self.client.post('/api/v1/nodes/claim/', body, format='json').status_code, 404)
        body['greenhouse_id'] = self.gh.id
        response = self.client.post('/api/v1/nodes/claim/', body, format='json')
        self.assertEqual(response.status_code, 429)
        self.assertGreater(response.data['retry_after_seconds'], 0)
        node.claim_locked_until = None
        node.save()
        result = self.client.post('/api/v1/nodes/claim/', body, format='json')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data['greenhouse_id'], self.gh.id)
        self.assertEqual(self.client.post('/api/v1/nodes/claim/', body, format='json').status_code, 400)

    def test_readings_thresholds_and_alerts_are_isolated(self):
        stamp = int(time.time())
        ConditionReading.objects.create(node=self.node, device_id='same', reading_ts=stamp, temperature=0)
        foreign_reading = ConditionReading.objects.create(node=self.other_node, device_id='same', reading_ts=stamp, temperature=99)
        threshold = Condition.objects.create(node=self.other_node, greenhouse=self.foreign, condition_id='foreign', condition_type='temperature_max', threshold_value=30)
        alert = Alert.objects.create(node=self.other_node, greenhouse=self.foreign, title='Private', message='Private')
        response = self.client.get('/api/v1/conditions/readings/?device_id=same&hours=24')
        data = response.data.get('results', []) if isinstance(response.data, dict) else response.data
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['temperature'], 0)
        self.assertEqual(self.client.get(f"/api/v1/conditions/readings/{data[0]['id']}/").status_code, 200)
        for path in [f'/conditions/readings/{foreign_reading.id}/', f'/conditions/thresholds/{threshold.id}/', f'/alerts/{alert.id}/']:
            self.assertEqual(self.client.get('/api/v1' + path).status_code, 404)
        body = {'greenhouse': self.foreign.id, 'node': self.other_node.id, 'condition_id': 'bad', 'condition_type': 'temperature', 'threshold_value': 3}
        self.assertEqual(self.client.post('/api/v1/conditions/thresholds/', body, format='json').status_code, 403)

    def test_dashboard_trends_are_measured_and_missing_values_preserved(self):
        stamp = int(time.time())
        ConditionReading.objects.create(node=self.node, device_id='sensor-a', reading_ts=stamp-60, temperature=10)
        ConditionReading.objects.create(node=self.node, device_id='sensor-a', reading_ts=stamp, temperature=0)
        ConditionReading.objects.create(node=self.node, device_id='sensor-b', reading_ts=stamp, humidity=65)
        result = self.client.get(f'/api/v1/reports/dashboard/?greenhouse={self.gh.id}').data
        self.assertEqual(len(result['tiles']), 6)
        temp = next(t for t in result['tiles'] if t['device_id'] == 'sensor-a' and t['sensor_kind'] == 'temperature')
        self.assertEqual(temp['value'], 0)
        self.assertEqual(temp['trend'], 'down')
        missing = next(t for t in result['tiles'] if t['device_id'] == 'sensor-b' and t['sensor_kind'] == 'temperature')
        self.assertIsNone(missing['value'])
        self.assertIsNone(missing['trend'])

    def test_actuator_cannot_be_reassigned_to_another_farm(self):
        response = self.client.patch(f'/api/v1/nodes/actuators/{self.actuator.id}/', {'node': self.other_node.id}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_farmers_cannot_fake_hardware_confirmation(self):
        self.client.patch(f'/api/v1/nodes/actuators/{self.actuator.id}/', {'is_active': True, 'confirmed_at': timezone.now().isoformat()}, format='json')
        self.actuator.refresh_from_db()
        self.assertFalse(self.actuator.is_active)
        self.assertIsNone(self.actuator.confirmed_at)
