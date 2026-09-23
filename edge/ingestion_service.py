"""
GreenNode edge ingestion service.

Subscribes to every sub-node's data topic, validates the publishing
device against the `connected_devices` allowlist before trusting anything
it sends, then writes the reading into the local `conditions` table for
later cloud sync.

Topic convention:
    greennode/<device_id>/data     sensor readings  (sub-node -> GreenNode)
    greennode/<device_id>/cmd      actuator commands (GreenNode -> sub-node)
    greennode/<device_id>/status   online/offline, via MQTT LWT

Payload convention (deliberately simple for the prototype phase):
    {"temperature": 60, "ts": 1737400000}
    One or more flat numeric/string fields, plus an optional device-supplied
    "ts" (unix seconds). If "ts" is absent, GreenNode stamps receipt time
    instead — devices with no RTC shouldn't need to know the real time.

Adjust the SQLAlchemy model below to match your actual `conditions` table
columns from the finalized edge schema — this uses a reasonably generic
shape (device_id, payload as JSON, synced flag) matching the "partial
index on synced=0" detail already in the schema, but the real column
names may differ.
"""

import json
import logging
import time

import paho.mqtt.client as mqtt
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from models import Condition, ConnectedDevice  # adjust import to your actual models module

# --- Configuration ------------------------------------------------------

MQTT_HOST = "127.0.0.1"
MQTT_PORT = 1883
MQTT_USER = "greennode-ingest"       # dedicated Mosquitto user for this service
MQTT_PASS = "CHANGE_ME"              # set via env var in production, not hardcoded
DATA_TOPIC_FILTER = "greennode/+/data"

DB_URL = "sqlite:///./greennode.db"  # match your actual edge DB path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("ingestion")

engine = create_engine(DB_URL)
Session = sessionmaker(bind=engine)


# --- Allowlist check ------------------------------------------------------

def is_device_allowed(session, device_id: str) -> bool:
    """
    Defense in depth: the MQTT broker's ACL should already stop a device
    from publishing to a topic that isn't its own, but this is a second,
    independent check against `connected_devices` — catches a
    revoked-but-not-yet-ACL-updated device, and makes the allowlist the
    single source of truth for "is this device trusted" rather than
    splitting that decision across two systems that could drift out of
    sync.
    """
    device = session.execute(
        select(ConnectedDevice).where(
            ConnectedDevice.device_id == device_id,
            ConnectedDevice.revoked == False,  # noqa: E712
        )
    ).scalar_one_or_none()
    return device is not None


# --- MQTT callbacks ------------------------------------------------------

def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        log.info("Connected to broker, subscribing to %s", DATA_TOPIC_FILTER)
        client.subscribe(DATA_TOPIC_FILTER, qos=1)
    else:
        log.error("Connection failed: %s", reason_code)


def on_message(client, userdata, msg):
    # topic shape: greennode/<device_id>/data
    parts = msg.topic.split("/")
    if len(parts) != 3:
        log.warning("Unexpected topic shape: %s", msg.topic)
        return
    device_id = parts[1]

    try:
        payload = json.loads(msg.payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        log.warning("Malformed payload from %s: %r", device_id, msg.payload[:200])
        return

    if not isinstance(payload, dict) or not payload:
        log.warning("Empty/non-object payload from %s", device_id)
        return

    received_ts = int(time.time())
    reading_ts = payload.pop("ts", received_ts)  # device-supplied ts, else receipt time

    session = Session()
    try:
        if not is_device_allowed(session, device_id):
            log.warning("Rejected reading from unregistered/revoked device: %s", device_id)
            return

        condition = Condition(
            device_id=device_id,
            payload=json.dumps(payload),
            reading_ts=reading_ts,
            received_ts=received_ts,
            synced=0,
        )
        session.add(condition)
        session.commit()
        log.info("Stored reading from %s: %s", device_id, payload)
    except Exception:
        session.rollback()
        log.exception("Failed to store reading from %s", device_id)
    finally:
        session.close()


def main():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="greennode-ingest")
    client.username_pw_set(MQTT_USER, MQTT_PASS)
    client.on_connect = on_connect
    client.on_message = on_message
    # Explicit backoff rather than relying on paho's defaults — a broker
    # restart (e.g. mosquitto reloading after a new device is paired)
    # shouldn't cause a reconnect storm.
    client.reconnect_delay_set(min_delay=1, max_delay=30)

    client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    client.loop_forever()


if __name__ == "__main__":
    main()
