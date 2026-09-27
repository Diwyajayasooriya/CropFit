/*
 * GreenNode sub-node firmware example — MQTT data model reference.
 *
 * Two roles shown in one file for reference; a real sensor build would
 * only need SENSOR_MODE, a real actuator build only ACTUATOR_MODE.
 * Assumes provisioning has already happened (Section 1.12 of README.md)
 * and this device has been assigned a permanent SSID, passphrase, and
 * device_id — those would come from NVS storage after provisioning in a
 * real build; hardcoded here for clarity.
 */

#include <WiFi.h>
#include <PubSubClient.h>

#define SENSOR_MODE   // comment out, define ACTUATOR_MODE instead, for an actuator build
// #define ACTUATOR_MODE

const char* WIFI_SSID     = "greennode-sensors";      // or greennode-actuators
const char* WIFI_PASS     = "CHANGE_ME";
const char* MQTT_HOST     = "10.0.10.1";              // GreenNode's gateway IP on this subnet
const int   MQTT_PORT     = 1883;
const char* MQTT_USER     = "CHANGE_ME";              // per-device creds issued at provisioning
const char* MQTT_PASS     = "CHANGE_ME";
const char* DEVICE_ID     = "esp32-soil-moisture-01"; // matches registry/devices.csv "name"

char dataTopic[64];
char cmdTopic[64];
char statusTopic[64];

WiFiClient espClient;
PubSubClient mqtt(espClient);

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) delay(500);
}

void connectMQTT() {
  while (!mqtt.connected()) {
    // Last-Will-and-Testament: if this device drops off ungracefully,
    // the broker publishes this on our behalf — GreenNode's ingestion
    // service can subscribe to greennode/+/status to notice immediately
    // rather than waiting for a timeout.
    mqtt.connect(DEVICE_ID, MQTT_USER, MQTT_PASS,
                 statusTopic, 1, true, "offline");
    if (!mqtt.connected()) delay(2000);
  }
  mqtt.publish(statusTopic, "online", true);

#ifdef ACTUATOR_MODE
  mqtt.subscribe(cmdTopic);
#endif
}

#ifdef ACTUATOR_MODE
void onCommand(char* topic, byte* payload, unsigned int length) {
  // Minimal example: expects {"action":"on","duration_s":300}
  // A real build would use ArduinoJson here rather than manual parsing.
  String msg((char*)payload, length);
  Serial.println("Command received: " + msg);
  // ... drive the relay/MOSFET based on parsed fields ...
}
#endif

void setup() {
  Serial.begin(115200);

  snprintf(dataTopic,   sizeof(dataTopic),   "greennode/%s/data",   DEVICE_ID);
  snprintf(cmdTopic,    sizeof(cmdTopic),    "greennode/%s/cmd",    DEVICE_ID);
  snprintf(statusTopic, sizeof(statusTopic), "greennode/%s/status", DEVICE_ID);

  connectWiFi();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);

#ifdef ACTUATOR_MODE
  mqtt.setCallback(onCommand);
#endif

  connectMQTT();
}

void loop() {
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();

#ifdef SENSOR_MODE
  static unsigned long lastPublish = 0;
  if (millis() - lastPublish > 60000) {  // every 60s — tune per sensor type
    lastPublish = millis();

    float soilMoisture = analogRead(34) / 40.95;  // placeholder scaling, calibrate per sensor

    char payload[64];
    snprintf(payload, sizeof(payload), "{\"soil_moisture\": %.1f}", soilMoisture);
    mqtt.publish(dataTopic, payload);
  }
#endif
}
