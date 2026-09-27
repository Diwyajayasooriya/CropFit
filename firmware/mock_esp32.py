"""
mock_esp32.py — Simulates ESP32 Sensor and Actuator nodes via MQTT
"""
import json
import time
import random
import threading
import paho.mqtt.client as mqtt

BROKER_HOST = "127.0.0.1"  # Or your Pi's IP if running this script on your PC
BROKER_PORT = 1883

SENSOR_ID = "mock-esp32-sensor-01"
ACTUATOR_ID = "mock-esp32-valve-01"

# --- Actuator Simulator ---
def on_actuator_connect(client, userdata, flags, reason_code, properties=None):
    print(f"[{ACTUATOR_ID}] Connected to broker.")
    # Subscribe to commands
    client.subscribe(f"greennode/{ACTUATOR_ID}/cmd", qos=1)
    # Publish online status
    client.publish(f"greennode/{ACTUATOR_ID}/status", json.dumps({"state": "idle", "online": True}), qos=1, retain=True)

def on_actuator_message(client, userdata, msg):
    try:
        cmd = json.loads(msg.payload.decode())
        action = cmd.get("action")
        duration = cmd.get("duration_s", 5)
        print(f"\n[ACTUATOR RECEIVED] Action: {action.upper()} for {duration} seconds")

        if action == "on":
            print(f"[{ACTUATOR_ID}] 🟢 Valve OPEN / Relay ENERGIZED")
            client.publish(f"greennode/{ACTUATOR_ID}/status", json.dumps({"state": "active", "action": "on"}))
            
            # Simulate timer
            def auto_off():
                time.sleep(duration)
                print(f"[{ACTUATOR_ID}] 🔴 Valve CLOSED / Relay DE-ENERGIZED (duration expired)")
                client.publish(f"greennode/{ACTUATOR_ID}/status", json.dumps({"state": "idle", "action": "off"}))
            
            threading.Thread(target=auto_off, daemon=True).start()

        elif action == "off":
            print(f"[{ACTUATOR_ID}] 🔴 Valve CLOSED manually")
            client.publish(f"greennode/{ACTUATOR_ID}/status", json.dumps({"state": "idle", "action": "off"}))

    except Exception as e:
        print(f"Error handling command: {e}")

def run_actuator():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="sim-actuator")
    # Set LWT
    client.will_set(f"greennode/{ACTUATOR_ID}/status", json.dumps({"online": False}), qos=1, retain=True)
    client.on_connect = on_actuator_connect
    client.on_message = on_actuator_message
    client.connect(BROKER_HOST, BROKER_PORT, 60)
    client.loop_forever()

# --- Sensor Simulator ---
def run_sensor():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="sim-sensor")
    client.will_set(f"greennode/{SENSOR_ID}/status", json.dumps({"online": False}), qos=1, retain=True)
    client.connect(BROKER_HOST, BROKER_PORT, 60)
    client.loop_start()

    print(f"[{SENSOR_ID}] Sensor simulation started. Publishing data every 5 seconds...")

    # Realistic baselines
    temp = 27.0
    humidity = 65.0
    soil_moisture = 42.0

    while True:
        # Subtle random walk to simulate changing environment
        temp = round(max(15.0, min(40.0, temp + random.uniform(-0.4, 0.4))), 2)
        humidity = round(max(30.0, min(95.0, humidity + random.uniform(-0.8, 0.8))), 2)
        soil_moisture = round(max(10.0, min(80.0, soil_moisture + random.uniform(-0.5, 0.2))), 2)

        payload = {
            "temperature": temp,
            "humidity": humidity,
            "soil_moisture": soil_moisture,
            "ts": int(time.time())
        }

        topic = f"greennode/{SENSOR_ID}/data"
        client.publish(topic, json.dumps(payload), qos=1)
        print(f"[{SENSOR_ID}] Published to {topic}: {payload}")
        time.sleep(5)

if __name__ == "__main__":
    # Start actuator listener thread
    actuator_thread = threading.Thread(target=run_actuator, daemon=True)
    actuator_thread.start()

    # Run sensor publisher on main thread
    time.sleep(1)
    run_sensor()
