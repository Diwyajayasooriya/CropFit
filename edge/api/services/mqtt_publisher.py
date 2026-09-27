import json
import logging
import time
from typing import Any, Dict, Optional

import paho.mqtt.client as mqtt
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.config import settings
from models import ActionLog, ConnectedDevice

log = logging.getLogger("edge.mqtt_publisher")


class MqttPublisherService:
    """
    Singleton service managing the MQTT client for dispatching actuator commands
    and recording them to local actions_log.
    """
    _instance: Optional["MqttPublisherService"] = None

    def __init__(self):
        self.connected = False
        self.client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2,
            client_id=f"greennode-api-{settings.NODE_ID}"
        )
        if settings.MQTT_USER and settings.MQTT_PASS != "CHANGE_ME":
            self.client.username_pw_set(settings.MQTT_USER, settings.MQTT_PASS)

        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect

    @classmethod
    def get_instance(cls) -> "MqttPublisherService":
        if cls._instance is None:
            cls._instance = MqttPublisherService()
        return cls._instance

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            self.connected = True
            log.info("MqttPublisher connected to local Mosquitto broker at %s:%s", settings.MQTT_HOST, settings.MQTT_PORT)
        else:
            self.connected = False
            log.error("MqttPublisher failed to connect to Mosquitto, rc=%s", rc)

    def _on_disconnect(self, client, userdata, rc, properties=None):
        self.connected = False
        log.warning("MqttPublisher disconnected from Mosquitto, rc=%s", rc)

    def start(self):
        try:
            self.client.reconnect_delay_set(min_delay=1, max_delay=30)
            self.client.connect_async(settings.MQTT_HOST, settings.MQTT_PORT, keepalive=60)
            self.client.loop_start()
        except Exception as e:
            log.warning("Could not initiate MQTT connection on startup: %s (will retry in background)", e)

    def stop(self):
        try:
            self.client.loop_stop()
            self.client.disconnect()
        except Exception:
            pass

    def send_command(
        self,
        db: Session,
        device_id: str,
        command: Dict[str, Any],
        triggered_by: str = "manual"
    ) -> bool:
        """
        Validates the actuator against the connected_devices allowlist,
        publishes the command via MQTT, and records it in actions_log.
        """
        # Allowlist check
        device = db.execute(
            select(ConnectedDevice).where(
                ConnectedDevice.device_id == device_id,
                ConnectedDevice.device_type == "actuator",
                ConnectedDevice.revoked == False,  # noqa: E712
            )
        ).scalar_one_or_none()

        if device is None:
            log.warning("Rejected command to unauthorized or non-actuator device: %s", device_id)
            return False

        topic = f"greennode/{device_id}/cmd"
        ts = int(time.time())
        payload = {**command, "ts": ts}

        # Publish MQTT packet (QoS 1)
        self.client.publish(topic, json.dumps(payload), qos=1)
        log.info("Dispatched command to topic '%s': %s", topic, payload)

        # Record into actions_log for local history and cloud sync
        action_name = command.get("action", "unknown")
        action_record = ActionLog(
            actuator_device_id=device_id,
            action=action_name,
            command_payload=json.dumps(payload),
            triggered_by=triggered_by,
            executed_ts=ts,
            synced=0
        )
        db.add(action_record)
        db.commit()

        return True


mqtt_publisher = MqttPublisherService.get_instance()
