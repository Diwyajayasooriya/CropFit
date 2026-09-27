# GreenNode — Data Pipeline: Sensor Ingestion & Actuator Control

Companion to `README.md` (networking layer) and `HARDWARE_SETUP.md` (physical
bring-up). This covers what happens once devices are provisioned and
connected: how GreenNode reads sensor data, how it decides what to do with
it, and how it controls actuators.

---

## Part 1 — Theory

### 1.1 Two different meanings of "GreenNode as middleman"

Worth being precise about this before anything else, since it shapes every
decision below.

**Model A — GreenNode as the intended endpoint.** A device is configured
(by us, since we control its firmware for the prototype) to publish
directly to GreenNode's own MQTT broker, at a topic it was told about
during provisioning. GreenNode isn't reading someone else's traffic here —
it *is* the destination the device is deliberately talking to.

**Model B — GreenNode as a passive tap on someone else's traffic.** A true
third-party device whose firmware GreenNode doesn't control, that only
knows how to talk to its own vendor's cloud. GreenNode sits on the network
path (it's the router for that subnet) and could in principle inspect
that traffic — but in practice this doesn't work: vendor-cloud traffic is
virtually always TLS-encrypted, and decrypting it in transit requires the
device to trust a certificate GreenNode controls, which means installing
GreenNode's CA cert into the device's trust store. That's only possible on
devices whose firmware you already control — which are exactly the devices
that don't need this technique, since they can just publish to GreenNode
directly instead (Model A). Beyond the technical wall, intercepting a
third-party vendor's proprietary cloud traffic — even on your own network —
sits in murky ToS/legal territory and isn't something to build toward.

**This pipeline is built entirely on Model A.** "Inspecting what
information a device contains" means reading the JSON payload a device
deliberately published to GreenNode's own broker — `{"temperature": 60}` —
not intercepting traffic bound elsewhere. A device's independent traffic to
its own vendor cloud (if any) already transits GreenNode via NAT and needs
no special handling — it's a separate, unrelated connection sharing the
same uplink.

### 1.2 Topic and payload convention

```
greennode/<device_id>/data     sensor readings   (sub-node -> GreenNode)
greennode/<device_id>/cmd      actuator commands (GreenNode -> sub-node)
greennode/<device_id>/status   online/offline, via MQTT Last-Will-and-Testament
```

Payloads are flat JSON objects — `{"temperature": 60}`, `{"soil_moisture": 42}`.
An optional `"ts"` field lets a device with its own clock supply a reading
timestamp; GreenNode stamps receipt time as a fallback for devices without
one (most won't have an RTC, and shouldn't need one).

`device_id` is deliberately opaque to this pipeline — whatever string gets
assigned at provisioning (hardware MAC or a GreenNode-issued pairing ID,
still an open question elsewhere) works identically here.

### 1.3 Sensor path — ingestion

```
ESP32 sensor --MQTT PUBLISH--> greennode/<device_id>/data
                                        |
                            Mosquitto ACL (device can only
                            publish to its own topic)
                                        |
                            ingestion_service.py subscribes
                            to greennode/+/data
                                        |
                            checks device_id against
                            `connected_devices` allowlist
                            (defense in depth — independent
                            of the MQTT ACL, so a revoked
                            device stops being trusted
                            immediately even before its ACL
                            file is regenerated)
                                        |
                            stored in `conditions`, synced=0
```

### 1.4 Actuator path — control

For now, actuator control is kept deliberately simple: GreenNode knows the
control topic for a given actuator (assigned at provisioning, same as
sensors), and a rule firing means "send this command to this known topic."
No dynamic capability discovery, no state feedback/reconciliation loop yet
— see Part 3 for why that's deferred rather than built now.

```
node_rules_cache (threshold + which        rules_engine reads latest
sensor + which actuator + what              condition row for the
command to send)                            rule's sensor
        |                                            |
        +---------------------> evaluate_rules() <---+
                                        |
                            threshold crossed?
                                        |
                        allowlist check (device_id is a
                        registered, non-revoked actuator)
                                        |
                            publish to greennode/<device_id>/cmd
                                        |
                            actuator subscribes, acts
```

The rules engine runs on a schedule (APScheduler, matching the existing
AI/ML stack) rather than continuously — well below sensor publish
frequency is enough, since it's always acting on the latest stored reading
either way.

### 1.5 Dashboard

The admin panel/mobile app reads from the same local tables the ingestion
service writes to (`conditions` for readings, and whatever surfaces
last-issued commands for actuators) — no separate data path needed for
"show it on the dashboard." Cloud sync (pushing `synced=0` rows to
PostgreSQL/TimescaleDB) is what makes this visible beyond the local
network, and is separate, already-scoped future work.

---

## Part 2 — Implementation

### 2.1 Files

| File | Role |
|---|---|
| `models.py` | SQLAlchemy shape for `connected_devices` and `conditions` — inferred, reconcile against the real Alembic migration before relying on it |
| `ingestion_service.py` | Subscribes to `greennode/+/data`, validates, stores |
| `actuator_dispatcher.py` | Publishes to `greennode/<device_id>/cmd`, same allowlist discipline on the way out |
| `rules_engine_example.py` | Ties the two together — reads a reading, evaluates a threshold, dispatches a command |
| `firmware_mqtt_example.cpp` | ESP32 side of both roles — publish (sensor) and subscribe (actuator), with LWT for offline detection |

### 2.2 What's customizable

| Where | What to change |
|---|---|
| `models.py` | Every column name — this is inferred, not copied from your real schema |
| `ingestion_service.py` | `MQTT_HOST`/`MQTT_USER`/`MQTT_PASS`, `DB_URL`; publish interval and which fields a given sensor sends are entirely up to the firmware, not this file |
| `actuator_dispatcher.py` | Same connection constants; `mqtt_user` should be a distinct Mosquitto credential from the ingestion service's, scoped only to publish on `cmd` topics |
| `rules_engine_example.py` | The entire `RULES` list — this is a placeholder shape, real rules should come from `node_rules_cache` once that table's read path exists |
| `firmware_mqtt_example.cpp` | `WIFI_SSID`/`PASS`, `MQTT_HOST`, per-device `MQTT_USER`/`PASS`/`DEVICE_ID` (all issued at provisioning in a real build, hardcoded here for clarity), the publish interval, and the actual sensor-reading logic (the analog-read line is a placeholder — calibrate per real sensor) |

### 2.3 Running order for a local test

1. Mosquitto running with a device credential set up matching one row in `connected_devices`.
2. `ingestion_service.py` running, subscribed and connected.
3. Flash `firmware_mqtt_example.cpp` (sensor mode) to an ESP32 on the sensor SSID.
4. Confirm rows appearing in `conditions` — `sqlite3 greennode.db "select * from conditions order by id desc limit 5;"`.
5. Flash a second board in actuator mode, confirm it's in `connected_devices` with `device_type='actuator'`.
6. Run `rules_engine_example.py` once manually, confirm it either fires (check the actuator's serial monitor for "Command received") or logs why it didn't (no recent reading, threshold not crossed).

---

## Part 3 — Deliberately deferred (the "think about later" list)

These are real gaps, named on purpose rather than quietly built around:

- **Actuator state feedback / reconciliation.** Right now the dashboard can show *the last command GreenNode sent*, not necessarily *the actuator's actual current state* — if a command is lost, or the actuator acts but doesn't confirm, GreenNode has no way to know. Closing this needs either the actuator publishing its own state back (its own `data`-shaped message, or a dedicated `status`/`state` topic) plus a reconciliation view, or command acknowledgment with retry. Not built now because it adds real complexity — a second topic/table, timeout handling, a UI treatment for "unconfirmed" — for a gap that doesn't block a first working prototype.
- **True third-party vendor devices (no local publish option).** Per 1.1, this needs vendor-specific integration — a local LAN API where the vendor exposes one, or an official cloud API otherwise — not an extension of this MQTT pipeline. Likely its own adapter/plugin per vendor when it becomes real, same shape as the SoftAP-provisioning deferral already noted for onboarding.
- **Rule conflict resolution.** Nothing currently stops two rules from targeting the same actuator with contradictory commands in the same evaluation cycle. Fine with one rule per actuator (today); needs a resolution strategy (priority ordering, last-write-wins, or an explicit conflict error) once rules get more numerous.
- **Command retry/QoS tuning.** Commands are fire-and-forget at QoS 1 (at-least-once delivery to the broker, not to a *listening* actuator — if the device is offline when a command is sent, it's simply missed unless the actuator subscribes at QoS 1 with a persistent session). Worth revisiting once offline-resilience work on the sub-node side is further along.
