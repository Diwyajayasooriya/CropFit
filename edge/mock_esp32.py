"""
GreenNode — ESP32 Hardware Simulator (Mock Node)

Simulates both an ESP32 sensor node and an ESP32 actuator node over MQTT.
Use this on your Raspberry Pi or PC to test the entire data pipeline
without needing physical microcontrollers or breadboards!

Features:
1. Pre-registers mock devices into SQLite connected_devices table automatically.
2. Publishes realistic soil moisture & DHT22 readings to greennode/<id>/data every 5s.
3. Subscribes to greennode/<id>/cmd and reacts to actuator commands in real-time.
"""

import json
import logging
import random
import sys
import threading
import time
from pathlib import Path

import paho.mqtt.client as mqtt
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

# Import models
EDGE_DIR = Path(__file__).resolve().parent
if str(EDGE_DIR) not in sys.path:
    sys.path.insert(0, str(EDGE_DIR))

from models import Base, ConnectedDevice

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [MOCK-ESP32] %(message)s")
log = logging.getLogger("mock_esp32")

# --- Configuration ---
MQTT_HOST = "127.0.0.1"
MQTT_PORT = 1883

SENSOR_DEVICE_ID = "esp32-sensor-mock-01"
ACTUATOR_DEVICE_ID = "esp32-actuator-mock-01"
DB_URL = "sqlite:///./greennode.db"

engine = create_engine(DB_URL)
SessionLocal = sessionmaker(bind=engine)


def ensure_mock_devices_in_db():
    """Ensure both mock devices exist in SQLite allowlist so ingestion and dispatcher don't reject them."""
    Base.metadata.create_all(engine)
    session = SessionLocal()
    try:
        # Check sensor
        sensor = session.execute(
            select(ConnectedDevice).where(ConnectedDevice.device_id == SENSOR_DEVICE_ID)
        ).scalar_one_or_none()
        if not sensor:
            session.add(
                ConnectedDevice(
                    device_id=SENSOR_DEVICE_ID,
                    device_type="sensor",
                    name="Simulated DHT22 & Soil Moisture",
                    revoked=False,
                    registered_ts=int(time.time()),
                )
            )

        # Check actuator
        actuator = session.execute(
            select(ConnectedDevice).where(ConnectedDevice.device_id == ACTUATOR_DEVICE_ID)
        ).scalar_one_or_none()
        if not actuator:
            session.add(
                ConnectedDevice(
                    device_id=ACTUATOR_DEVICE_ID,
                    device_type="actuator",
                    name="Simulated Irrigation Solenoid Valve",
                    revoked=False,
                    registered_ts=int(time.time()),
                )
            )

        session.commit()
        log.info("Mock devices registered in local SQLite allowlist (%s, %s)", SENSOR_DEVICE_ID, ACTUATOR_DEVICE_ID)
    finally:
        session.close()


# --- Actuator Simulation ---
def on_actuator_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        action = payload.get("action", "unknown")
        duration = payload.get("duration_s", 5)

        log.info("🔔 [ACTUATOR] Received command on %s: %s", msg.topic, payload)

        if action in ("on", "open"):
            log.info("💧 >>> [VALVE] Solenoid relay OPENED! Watering crops for %ds... <<<", duration)

            def auto_shutoff():
                time.sleep(duration)
                log.info("🛑 >>> [VALVE] Solenoid relay CLOSED (duration expired). <<<")

            threading.Thread(target=auto_shutoff, daemon=True).start()
        elif action in ("off", "close"):
            log.info("🛑 >>> [VALVE] Solenoid relay manually CLOSED. <<<")
    except Exception as e:
        log.error("Failed to process command: %s", e)


def start_actuator_subscriber():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="mock-esp32-actuator")
    client.on_message = on_actuator_message
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    cmd_topic = f"greennode/{ACTUATOR_DEVICE_ID}/cmd"
    client.subscribe(cmd_topic, qos=1)
    log.info("Actuator node listening on topic: %s", cmd_topic)
    client.loop_start()
    return client


# --- Sensor Simulation ---
def run_sensor_publisher():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="mock-esp32-sensor")
    # LWT
    client.will_set(f"greennode/{SENSOR_DEVICE_ID}/status", json.dumps({"online": False}), qos=1, retain=True)
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    client.loop_start()

    data_topic = f"greennode/{SENSOR_DEVICE_ID}/data"
    log.info("Sensor node started. Publishing telemetry to %s every 5 seconds...", data_topic)

    # Initial realistic values
    temp = 27.5
    humidity = 65.0
    soil_moisture = 38.0

    try:
        while True:
            # Small random walk to simulate greenhouse microclimate
            temp = round(temp + random.uniform(-0.3, 0.3), 1)
            humidity = round(max(30.0, min(95.0, humidity + random.uniform(-0.5, 0.5))), 1)
            # Soil moisture slowly drops until watered
            soil_moisture = round(max(15.0, soil_moisture - 0.2), 1)

            payload = {
                "temperature": temp,
                "humidity": humidity,
                "soil_moisture": soil_moisture,
                "battery_pct": 95,
                "ts": int(time.time()),
            }

            client.publish(data_topic, json.dumps(payload), qos=0)
            log.info("📡 [SENSOR] Published reading: Temp=%.1f°C | Hum=%.1f%% | SoilMoist=%.1f%%", temp, humidity, soil_moisture)
            time.sleep(5)
    except KeyboardInterrupt:
        log.info("Stopping mock ESP32 nodes...")
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    ensure_mock_devices_in_db()
    actuator_client = start_actuator_subscriber()
    time.sleep(1)
    run_sensor_publisher()
