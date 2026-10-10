"""Outbound cloud commands -> local MQTT -> correlated device acknowledgement.

The actuator firmware must echo command_id on greennode/<id>/ack AFTER setting
its output. MQTT publish success alone is never treated as hardware success.
"""
import json
import logging
import os
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from contextlib import closing

log = logging.getLogger('cropfit.commands')


class CommandWorker:
    def __init__(self, cloud, journal_path, mqtt_factory=None):
        self.cloud = cloud
        self.journal_path = Path(journal_path)
        self.mqtt_factory = mqtt_factory

    def tick(self):
        commands = self.cloud.poll_commands()
        for command in commands[:1]:
            self.journal_path.parent.mkdir(parents=True, exist_ok=True)
            with closing(sqlite3.connect(self.journal_path)) as db:
                db.execute('CREATE TABLE IF NOT EXISTS command_results (id TEXT PRIMARY KEY, payload TEXT NOT NULL)')
                row = db.execute('SELECT payload FROM command_results WHERE id = ?', (command['id'],)).fetchone()
                if row:
                    result = json.loads(row[0])
                else:
                    result = self.execute(command)
                    db.execute('INSERT INTO command_results VALUES (?, ?)', (command['id'], json.dumps(result)))
                    db.commit()
                # Persist result before HTTP acknowledgement so retries survive reboot.
                self.cloud.ack_command(result)

    def execute(self, command):
        command_id = command['id']
        failure = {'command_id': command_id, 'status': 'failed'}
        if datetime.fromisoformat(command['expires_at']) <= datetime.now(timezone.utc):
            return {**failure, 'error': 'Command expired before delivery.'}
        device_id = command['actuator_id']
        if any(char in device_id for char in '+#/\x00'):
            return {**failure, 'error': 'Actuator ID is not a valid MQTT topic segment.'}
        config = self.cloud.fetch_config()
        if not config or device_id not in {a['actuator_id'] for a in config.get('actuators', [])}:
            return {**failure, 'error': 'Actuator is not authorized for this hub.'}
        import paho.mqtt.client as mqtt
        client = self.mqtt_factory() if self.mqtt_factory else mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        username = os.environ.get('MQTT_COMMAND_USER', os.environ.get('MQTT_USER', 'greennode-dispatch'))
        if username:
            client.username_pw_set(username, os.environ.get('MQTT_COMMAND_PASS', os.environ.get('MQTT_PASS', '')))
        done = threading.Event()
        result = {**failure, 'error': 'No hardware acknowledgement received; state is unknown.'}
        ack_topic = f'greennode/{device_id}/ack'

        def connected(client, userdata, flags, reason_code, properties=None):
            if reason_code == 0:
                client.subscribe(ack_topic, qos=1)

        def subscribed(client, userdata, mid, reason_codes, properties=None):
            if any(getattr(code, 'is_failure', False) for code in reason_codes):
                done.set()
                return
            client.publish(f'greennode/{device_id}/cmd', json.dumps({
                'command_id': command_id, 'action': command['action'].lower(),
                'expires_at': command['expires_at'],
            }), qos=1, retain=False)

        def received(client, userdata, message):
            nonlocal result
            try:
                payload = json.loads(message.payload)
                if message.topic != ack_topic or payload.get('command_id') != command_id:
                    return
                expected = command['action'] == 'ON'
                if payload.get('status') == 'confirmed' and payload.get('is_active') is expected:
                    result = {'command_id': command_id, 'status': 'confirmed', 'is_active': expected}
                    done.set()
                elif payload.get('status') == 'failed':
                    result = {**failure, 'error': 'Actuator reported that the command failed.'}
                    done.set()
            except (ValueError, TypeError):
                pass

        client.on_connect = connected
        client.on_subscribe = subscribed
        client.on_message = received
        try:
            client.connect_async(os.environ.get('MQTT_HOST', '127.0.0.1'), int(os.environ.get('MQTT_PORT', '1883')), keepalive=30)
            client.loop_start()
            done.wait(8)
        except Exception:
            result = {**failure, 'error': 'Local MQTT delivery failed.'}
        finally:
            client.disconnect()
            client.loop_stop()
        return result
