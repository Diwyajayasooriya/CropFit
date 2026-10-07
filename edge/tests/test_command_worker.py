import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.command_worker import CommandWorker


class FakeMqtt:
    def username_pw_set(self, *args): pass
    def connect_async(self, *args, **kwargs): pass
    def loop_start(self): self.on_connect(self, None, None, 0)
    def subscribe(self, topic, **kwargs):
        self.topic = topic
        self.on_subscribe(self, None, 1, [])
    def publish(self, topic, body, **kwargs):
        command = json.loads(body)
        self.on_message(self, None, SimpleNamespace(topic=self.topic, payload=json.dumps({'command_id': command['command_id'], 'status': 'confirmed', 'is_active': command['action'] == 'on'})))
    def disconnect(self): pass
    def loop_stop(self): pass


class CommandWorkerTests(unittest.TestCase):
    def setUp(self):
        self.command = {'id': 'command-a', 'actuator_id': 'fan-a', 'action': 'ON', 'expires_at': (datetime.now(timezone.utc) + timedelta(seconds=120)).isoformat()}
        self.cloud = Mock()
        self.cloud.poll_commands.return_value = [self.command]
        self.cloud.fetch_config.return_value = {'actuators': [{'actuator_id': 'fan-a'}]}

    def test_mqtt_ack_is_correlated_and_journal_prevents_reexecution(self):
        with tempfile.TemporaryDirectory() as folder:
            factory = Mock(side_effect=FakeMqtt)
            worker = CommandWorker(self.cloud, Path(folder) / 'commands.db', factory)
            worker.tick()
            CommandWorker(self.cloud, Path(folder) / 'commands.db', factory).tick()
            self.assertEqual(factory.call_count, 1)
            self.assertEqual(self.cloud.ack_command.call_count, 2)
            self.assertEqual(self.cloud.ack_command.call_args.args[0], {'command_id': 'command-a', 'status': 'confirmed', 'is_active': True})

    def test_unrelated_ack_never_confirms_hardware(self):
        class WrongAck(FakeMqtt):
            def publish(self, topic, body, **kwargs):
                self.on_message(self, None, SimpleNamespace(topic=self.topic, payload=json.dumps({'command_id': 'other', 'status': 'confirmed', 'is_active': True})))
        worker = CommandWorker(self.cloud, 'unused.db', WrongAck)
        with patch('app.command_worker.threading.Event') as event:
            event.return_value.wait.return_value = False
            self.assertEqual(worker.execute(self.command)['status'], 'failed')

    def test_expired_and_unauthorized_commands_are_not_published(self):
        factory = Mock()
        worker = CommandWorker(self.cloud, 'unused.db', factory)
        self.command['expires_at'] = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
        self.assertEqual(worker.execute(self.command)['status'], 'failed')
        self.command['expires_at'] = (datetime.now(timezone.utc) + timedelta(seconds=120)).isoformat()
        self.cloud.fetch_config.return_value = {'actuators': []}
        self.assertEqual(worker.execute(self.command)['status'], 'failed')
        factory.assert_not_called()


if __name__ == '__main__': unittest.main()
