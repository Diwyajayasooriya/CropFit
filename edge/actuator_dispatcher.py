"""
GreenNode -> actuator command dispatch.

Companion to ingestion_service.py — same broker, opposite direction.
This would typically be called from your rules engine / API layer
(whatever decides "turn on the fan"), not run as its own standalone
service — shown here as a small reusable client class.
"""

import json
import time

import paho.mqtt.client as mqtt
from sqlalchemy import select
from sqlalchemy.orm import Session as SQLASession

from models import ConnectedDevice


class ActuatorDispatcher:
    def __init__(self, mqtt_host="127.0.0.1", mqtt_port=1883,
                 mqtt_user="greennode-dispatch", mqtt_pass="CHANGE_ME"):
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="greennode-dispatch")
        self.client.username_pw_set(mqtt_user, mqtt_pass)
        self.client.reconnect_delay_set(min_delay=1, max_delay=30)
        self.client.connect(mqtt_host, mqtt_port, keepalive=60)
        self.client.loop_start()

    def send_command(self, session: SQLASession, device_id: str, command: dict) -> bool:
        """Returns False without publishing anything if the device isn't
        a registered, non-revoked actuator — same allowlist discipline as
        the ingestion side, just checked before sending instead of
        before storing."""
        device = session.execute(
            select(ConnectedDevice).where(
                ConnectedDevice.device_id == device_id,
                ConnectedDevice.device_type == "actuator",
                ConnectedDevice.revoked == False,  # noqa: E712
            )
        ).scalar_one_or_none()

        if device is None:
            return False

        topic = f"greennode/{device_id}/cmd"
        payload = {**command, "ts": int(time.time())}
        self.client.publish(topic, json.dumps(payload), qos=1)
        return True


# Example usage from a rules engine:
#   dispatcher.send_command(session, "esp32-irrigation-valve-01", {"action": "on", "duration_s": 300})
