# Green Node — Full Phase-by-Phase Implementation Plan

> **Team BlueCircle** | "Let it care. Grow at leisure."

---

## What's Already Built (Current State)

Before diving into phases, here's what your codebase already has:

### ✅ Completed Components

| Layer | What Exists | Files |
|-------|------------|-------|
| **Network / Pi** | Full hostapd AP setup, DHCP, MAC-based device registry, MQTT (Mosquitto) config, udev rules, IP forwarding, bandwidth shaping (HTB/tc), pairing watcher daemon, shedding daemon | [`network/`](file:///d:/clone/pyqt/CropFit/network) |
| **Edge (Pi)** | MQTT ingestion service, actuator command dispatcher, rules engine (threshold-based), SQLAlchemy models (ConnectedDevice, Condition), SQLite local DB init | [`edge/`](file:///d:/clone/pyqt/CropFit/edge) |
| **Firmware** | ESP32 MQTT example (sensor + actuator modes), LWT for offline detection, provisioning sketch | [`firmware/`](file:///d:/clone/pyqt/CropFit/firmware) |
| **Cloud Backend** | Django + DRF, JWT auth (SimpleJWT), apps for: authentication, greenhouses, nodes, sensors, conditions, rules, alerts, devices, zones, sensorHistory, reports | [`backend/`](file:///d:/clone/pyqt/CropFit/backend) |
| **Web Dashboard** | Next.js app with: login, dashboard (sensor tiles + actuator toggles), devices page, rules page, alerts page, admin section, auth guards, toast system, Zustand stores, mock data fallback | [`web/`](file:///d:/clone/pyqt/CropFit/web) |
| **Docs** | Network theory, data pipeline, hardware setup, ML/rules process, schema (mermaid ER diagram), crop database | [`docs/`](file:///d:/clone/pyqt/CropFit/docs) |

### ❌ What's Missing / Incomplete

- **FastAPI on Pi** — The edge runs raw Python scripts, not a FastAPI service yet
- **Cloud Sync** — `synced=0` flag exists but no actual sync job between edge SQLite → Django/cloud DB
- **ML Models** — Documented in theory ([`greennode-ml-rules-process.md`](file:///d:/clone/pyqt/CropFit/docs/greennode-ml-rules-process.md)) but zero implementation
- **Backend API endpoints** — Most Django apps are scaffolded (empty `views.py`) except auth and the single `PostSensorData` endpoint
- **Real sensor data flow** — Dashboard uses mock data; no live MQTT → API → frontend pipeline
- **WebSocket / real-time** — `websocket.ts` exists in frontend but no backend WebSocket support
- **Edge-to-Cloud API bridge** — Pi needs FastAPI to expose local data; Django needs endpoints to receive synced data
- **Rule CRUD** — Backend `rules` app is empty; edge rules are hardcoded in the example

---

## Architecture Overview (From Your Diagram)

```
┌─────────────────┐      MQTT       ┌────────────────────────────────┐     HTTPS/MQTT      ┌──────────────────┐
│  Sensors &      │ ──────────────► │  Raspberry Pi (Edge Gateway)   │ ──────────────────► │  Cloud Backend   │
│  Actuators      │ ◄────────────── │                                │ ◄────────────────── │  (Django + DRF)  │
│  (ESP32/Pico W) │    commands     │  ┌──────────────────────────┐  │       sync          │                  │
│                 │                 │  │ Mosquitto MQTT Broker    │  │                     │  ┌────────────┐  │
│  • DHT22        │                 │  │ SQLite (local cache)     │  │                     │  │ PostgreSQL │  │
│  • Soil Moist.  │                 │  │ FastAPI (data API)       │  │                     │  │ Store Data │  │
│  • Relay/Valve  │                 │  │ Rules Engine             │  │                     │  │ Dashboard  │  │
│  • Vent Motor   │                 │  │ ML Inference (TFLite)    │  │                     │  └────────────┘  │
└─────────────────┘                 │  └──────────────────────────┘  │                     └──────────────────┘
                                    │                                │
                                    │  * Internet goes down but      │
                                    │    automation still works!     │
                                    └────────────────────────────────┘
```

---

## Phase 1 — Core Hub & Connectivity (Weeks 1–4)

> **Goal:** Sensors and actuators physically talk to the Pi via MQTT. Data is stored locally.

### 1.1 — Hardware Setup & Pi Configuration
**What you'll learn:** Linux networking, systemd services, DHCP/DNS, WiFi AP mode

- [ ] Buy hardware per [`hardware_setup.md`](file:///d:/clone/pyqt/CropFit/docs/hardware_setup.md) (Pi 4/5, USB WiFi adapter, ESP32 boards, sensors)
- [ ] Flash Raspberry Pi OS Lite (64-bit), switch to dhcpcd network stack
- [ ] Deploy the [`network/`](file:///d:/clone/pyqt/CropFit/network) configs: hostapd, dnsmasq, Mosquitto, udev rules
- [ ] Run [`network/scripts/install.sh`](file:///d:/clone/pyqt/CropFit/network/scripts/install.sh) on the Pi
- [ ] Verify: `systemctl status hostapd dnsmasq` — AP is broadcasting, DHCP is assigning IPs

### 1.2 — ESP32 Firmware — Sensor Node
**What you'll learn:** Arduino/PlatformIO, MQTT protocol (PubSubClient), sensor reading

- [ ] Set up PlatformIO project based on [`firmware/firmware_mqtt_example.cpp`](file:///d:/clone/pyqt/CropFit/firmware/firmware_mqtt_example.cpp)
- [ ] Wire DHT22 (temp/humidity) + capacitive soil moisture sensor to ESP32
- [ ] Implement `SENSOR_MODE`: read sensors → publish JSON to `greennode/<device_id>/data`
- [ ] Add LWT (Last Will and Testament) for offline detection via `greennode/<device_id>/status`
- [ ] Flash and verify data arrives at Mosquitto: `mosquitto_sub -t "greennode/+/data" -v`

### 1.3 — ESP32 Firmware — Actuator Node
**What you'll learn:** MQTT subscribe, relay control, command parsing

- [ ] Wire relay module to ESP32 GPIO
- [ ] Implement `ACTUATOR_MODE`: subscribe to `greennode/<device_id>/cmd`, parse JSON commands
- [ ] Handle `{"action": "on", "duration_s": 300}` → drive relay for specified duration
- [ ] Publish status back on `greennode/<device_id>/status`
- [ ] Test: `mosquitto_pub -t "greennode/esp32-irrigation-valve-01/cmd" -m '{"action":"on","duration_s":10}'`

### 1.4 — Edge Ingestion Service (on Pi)
**What you'll learn:** paho-mqtt (Python), SQLAlchemy, SQLite, event-driven architecture

- [ ] Deploy [`edge/models.py`](file:///d:/clone/pyqt/CropFit/edge/models.py) and [`edge/init_db.py`](file:///d:/clone/pyqt/CropFit/edge/init_db.py) — create the local SQLite DB
- [ ] Run [`edge/ingestion_service.py`](file:///d:/clone/pyqt/CropFit/edge/ingestion_service.py) as a systemd service
- [ ] Verify sensor data flows: ESP32 → MQTT → ingestion_service → SQLite `conditions` table
- [ ] Register devices in `connected_devices` table (allowlist)

### 1.5 — Device Pairing Flow
**What you'll learn:** Device provisioning, security (per-device MQTT credentials)

- [ ] The [`network/scripts/pairing_watcher.py`](file:///d:/clone/pyqt/CropFit/network/scripts/pairing_watcher.py) is already built
- [ ] Test the pairing window: `curl -X POST http://127.0.0.1:8091/pairing/open -d '{"seconds": 120}'`
- [ ] Flash ESP32 with provisioning firmware from [`hardware_setup.md`](file:///d:/clone/pyqt/CropFit/docs/hardware_setup.md) Part 3
- [ ] Verify: new device appears in registry, gets MQTT credentials

> [!TIP]
> **Phase 1 Checkpoint:** At this point you should be able to see sensor readings appearing in `sqlite3 greennode.db "SELECT * FROM conditions ORDER BY id DESC LIMIT 10;"` and send commands to actuators via `mosquitto_pub`.

---

## Phase 2 — FastAPI Edge API + Django Cloud Backend + Dashboard (Weeks 5–10)

> **Goal:** Pi runs FastAPI to serve local data. Django cloud backend receives synced data. Dashboard shows real readings.

### 2.1 — FastAPI on Raspberry Pi (NEW — does not exist yet)
**What you'll learn:** FastAPI, Pydantic models, async Python, REST API design

Create a new `edge/api/` directory:

```
edge/
├── api/
│   ├── main.py              # FastAPI app entry point
│   ├── routers/
│   │   ├── sensors.py        # GET /sensors/latest, GET /sensors/history
│   │   ├── actuators.py      # GET /actuators, POST /actuators/{id}/command
│   │   ├── devices.py        # GET /devices, POST /devices/register
│   │   ├── rules.py          # GET /rules, POST /rules, PUT /rules/{id}
│   │   └── sync.py           # POST /sync/trigger, GET /sync/status
│   ├── models/
│   │   └── schemas.py        # Pydantic request/response models
│   ├── services/
│   │   ├── mqtt_publisher.py # Wraps ActuatorDispatcher for API use
│   │   └── sync_service.py   # Pushes synced=0 rows to cloud Django
│   └── config.py             # Settings (DB URL, MQTT host, cloud URL)
├── ingestion_service.py      # (existing)
├── actuator_dispatcher.py    # (existing)
├── rules_engine_example.py   # (existing)
└── models.py                 # (existing)
```

**Key endpoints to build:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/sensors/latest` | Latest reading per sensor device |
| `GET` | `/api/sensors/{device_id}/history?hours=24` | Time-series for a specific sensor |
| `GET` | `/api/actuators` | List all actuators + current state |
| `POST` | `/api/actuators/{device_id}/command` | Send command (calls ActuatorDispatcher) |
| `GET` | `/api/devices` | All connected devices |
| `POST` | `/api/devices/register` | Register a new device |
| `GET` | `/api/rules` | List active rules from `node_rules_cache` |
| `POST` | `/api/rules` | Create/update a threshold rule |
| `POST` | `/api/sync/push` | Manually trigger sync to cloud |
| `GET` | `/api/status` | Hub health (uptime, device count, last sync) |

### 2.2 — Django Cloud Backend API Endpoints (Mostly empty — needs building)
**What you'll learn:** Django REST Framework, serializers, viewsets, PostgreSQL

**Current state:** Most apps have empty `views.py`. Need to build out:

#### Greenhouse App
- [ ] `GET /api/v1/greenhouses/` — List user's greenhouses
- [ ] `POST /api/v1/greenhouses/` — Create greenhouse
- [ ] `GET /api/v1/greenhouses/{id}/` — Detail with nodes

#### Node App
- [ ] `GET /api/v1/nodes/` — List nodes for a greenhouse
- [ ] `POST /api/v1/nodes/sensordata/` — Already exists ([`postSensorData.py`](file:///d:/clone/pyqt/CropFit/backend/apps/node/sensor/sensorServices/postSensorData.py))
- [ ] `GET /api/v1/nodes/{id}/sensors/` — Sensors attached to a node
- [ ] `GET /api/v1/nodes/{id}/conditions/` — Condition history

#### Conditions App
- [ ] `POST /api/v1/conditions/bulk-sync/` — **Edge sync endpoint** — receives batch of readings from Pi
- [ ] `GET /api/v1/conditions/?greenhouse={id}&hours=24` — Query condition history

#### Rules App
- [ ] `GET /api/v1/rules/` — List rules (fleet-wide + per-greenhouse)
- [ ] `POST /api/v1/rules/` — Create rule
- [ ] `PUT /api/v1/rules/{id}/` — Update rule
- [ ] `POST /api/v1/rules/deploy/{node_id}/` — Push rules to a specific Pi's `node_rules_cache`

#### Devices App
- [ ] `GET /api/v1/devices/` — List all devices across greenhouses
- [ ] `POST /api/v1/devices/sync/` — Receive device registry from Pi

#### Alerts App
- [ ] `GET /api/v1/alerts/` — List alerts
- [ ] `POST /api/v1/alerts/` — Create alert (from rule violations)
- [ ] `PATCH /api/v1/alerts/{id}/acknowledge/` — Mark as read

#### Reports App
- [ ] `GET /api/v1/reports/summary/` — Aggregated stats (water usage, energy)

### 2.3 — Edge → Cloud Sync Service
**What you'll learn:** Background task scheduling, HTTP sync, conflict resolution, offline resilience

- [ ] Build `edge/api/services/sync_service.py`:
  - Query `conditions WHERE synced=0`, batch them (e.g. 100 rows)
  - POST to Django's `/api/v1/conditions/bulk-sync/` with Pi's `node_uid`
  - On success → mark rows `synced=1`
  - On failure (no internet) → retry with exponential backoff
- [ ] Same pattern for `actions_log WHERE synced=0` → `/api/v1/actions/bulk-sync/`
- [ ] Run as APScheduler job every 60 seconds
- [ ] Log sync status for dashboard display

### 2.4 — Wire the Next.js Dashboard to Real APIs
**What you'll learn:** React state management (Zustand), API integration, real-time updates

- [ ] Replace mock data in [`web/lib/mock-data.ts`](file:///d:/clone/pyqt/CropFit/web/lib/mock-data.ts) with real API calls
- [ ] Dashboard ([`web/app/page.tsx`](file:///d:/clone/pyqt/CropFit/web/app/page.tsx)):
  - Fetch sensor tiles from Django `/api/v1/conditions/latest/`
  - Fetch actuator state from Django `/api/v1/devices/?type=actuator`
  - Actuator toggle → POST to Django → Django forwards to Pi FastAPI → MQTT command
- [ ] Implement WebSocket or SSE for real-time sensor updates (optional, polling works first)
- [ ] Build the Rules CRUD UI (create/edit/delete threshold rules)
- [ ] Build the Alerts page (list, acknowledge, filter by severity)

### 2.5 — Rule Engine (Database-Driven)
**What you'll learn:** Dynamic rule evaluation, cron scheduling, safety baselines

- [ ] Replace hardcoded `RULES` list in [`rules_engine_example.py`](file:///d:/clone/pyqt/CropFit/edge/rules_engine_example.py) with DB reads from `node_rules_cache`
- [ ] Support compound conditions: `IF temp > 35 AND humidity < 40 THEN fan ON + irrigation ON`
- [ ] Add `actions_log` writes for every rule firing (audit trail)
- [ ] Run rules engine via APScheduler every 30-60 seconds on Pi
- [ ] Implement rule conflict detection (two rules targeting same actuator)

> [!TIP]
> **Phase 2 Checkpoint:** Farmer opens web dashboard → sees real sensor data from greenhouse → can toggle actuators → can create rules like "if soil moisture < 30%, start irrigation" → rules auto-execute on Pi even when internet is down.

---

## Phase 3 — Real Greenhouse Pilot (Weeks 11–16)

> **Goal:** Deploy in a real greenhouse (Central Province). Test with mixed devices, real conditions, offline operation.

### 3.1 — Pilot Site Setup
**What you'll learn:** Field deployment, ruggedization, power management

- [ ] Identify pilot greenhouse (Central Province, vegetable growing)
- [ ] Install Pi in weatherproof enclosure, connect power (UPS for outage resilience)
- [ ] Deploy 5-10 sensor nodes across the greenhouse (mixed: temp, humidity, soil moisture, light)
- [ ] Deploy 2-3 actuator nodes (irrigation valve, exhaust fan, vent)
- [ ] Configure [`registry/devices.csv`](file:///d:/clone/pyqt/CropFit/network/registry/devices.csv) with all real device MACs

### 3.2 — Offline Resilience Testing
**What you'll learn:** Edge computing reliability, graceful degradation

- [ ] Disconnect Pi from internet → verify rules engine continues operating
- [ ] Verify sensor data queues locally (`synced=0` rows accumulate)
- [ ] Reconnect → verify sync catches up (all queued data pushed to cloud)
- [ ] Test: what happens if Pi reboots? (systemd services auto-restart)
- [ ] Test: what happens if an ESP32 loses WiFi? (LWT triggers, status → "offline")

### 3.3 — Multi-Brand Device Testing
**What you'll learn:** Protocol adapters, device abstraction

- [ ] Test with devices from different manufacturers
- [ ] If a device doesn't speak MQTT natively → build adapter (MQTT bridge or HTTP-to-MQTT proxy)
- [ ] Document which protocols need adapters for future reference

### 3.4 — Baseline Measurement (for Impact slide claims)
**What you'll learn:** Data collection, KPIs, farmer feedback

- [ ] Measure water usage: track irrigation actuator ON/OFF durations and correlate with soil moisture
- [ ] Measure energy: track fan/vent actuator run times
- [ ] Measure time: how long does farmer spend managing the greenhouse (before vs. after Green Node)
- [ ] Collect farmer feedback: usability of the single-dashboard interface

> [!TIP]
> **Phase 3 Checkpoint:** A working Green Node in a real greenhouse, 10+ device types integrated, farmer using one interface without training, collecting real data for impact metrics.

---

## Phase 4 — ML & Edge AI (Weeks 17–24)

> **Goal:** Green Node makes intelligent decisions locally using ML models, not just threshold rules.

### 4.1 — Data Collection & Feature Engineering
**What you'll learn:** Time-series data, feature engineering, pandas/numpy

- [ ] Export `conditions` history from cloud DB (weeks of sensor data from Phase 3)
- [ ] Build feature vectors: `[temp, humidity, soil_moisture, light, co2, time_of_day, season, crop_type]`
- [ ] Label data with `actions_log`: what action was taken at what condition
- [ ] Clean data: handle missing readings, sensor drift, outliers

### 4.2 — Stage 1 ML: Threshold Learning (per [`greennode-ml-rules-process.md`](file:///d:/clone/pyqt/CropFit/docs/greennode-ml-rules-process.md))
**What you'll learn:** scikit-learn, agronomic priors, cold-start problem

- [ ] Build threshold model: given crop + location + season → optimal bands for each sensor metric
- [ ] Start from agronomic priors (published ideal ranges per crop)
- [ ] Adjust for location using historical `conditions` data
- [ ] Output: updated `node_rules_cache` entries (replaces manually-set thresholds)
- [ ] Push learned thresholds from cloud → Pi via API

### 4.3 — Stage 2 ML: Adaptive Thresholds
**What you'll learn:** Online learning, drift detection, farmer override signals

- [ ] Detect when greenhouse consistently sits near edge of threshold band
- [ ] Detect farmer overrides (manual actions before/after threshold breach)
- [ ] Periodically re-fit threshold bands based on accumulated evidence
- [ ] Safety: never auto-deploy adapted thresholds without farmer confirmation
- [ ] Build "threshold suggestion" UI: "Based on 3 weeks of data, we suggest adjusting temperature threshold from 30°C to 32°C"

### 4.4 — Stage 3 ML: Action Prediction (Imitation Learning)
**What you'll learn:** Classification, TensorFlow/ONNX, edge inference

- [ ] Train model: condition vector → action label (which actuator + duration)
- [ ] Start with scikit-learn classifier (Random Forest / Gradient Boosting)
- [ ] Convert to TFLite or ONNX for edge inference on Pi
- [ ] Integrate into rules engine: ML prediction runs alongside (not replacing) threshold rules
  ```
  Rule Engine Decision Flow:
  1. Check threshold rules (safety baseline) → if triggered, act immediately
  2. If no threshold breach, ask ML model: "given current conditions, should we proactively act?"
  3. ML suggests action → log as "ml-suggested" in actions_log
  4. Initially: show suggestion to farmer. Later: auto-execute with farmer veto window.
  ```
- [ ] Deploy model to Pi: `edge/ml/models/action_predictor.tflite`
- [ ] Run inference via `tflite_runtime` or `onnxruntime` on Pi

### 4.5 — Coordinated Multi-Actuator Decisions
**What you'll learn:** Multi-output models, actuator coordination

- [ ] Instead of single-actuator decisions, model considers all actuators together:
  - "Temperature high + humidity low → fan ON + misting ON (not just fan)"
  - "Soil moisture low + temperature moderate → irrigate now (not later)"
- [ ] Prevent conflicting actions (fan cooling vs. heating)
- [ ] Implement priority/conflict resolution in the rules engine

> [!TIP]
> **Phase 4 Checkpoint:** Green Node makes proactive decisions — "it's going to get too hot in 2 hours based on the trend, start ventilation now" — using ML models running locally on the Pi, without depending on the cloud.

---

## Project File Structure (Target)

```
CropFit/
├── backend/                    # Django Cloud Backend
│   ├── apps/
│   │   ├── authentication/     # ✅ User auth (JWT)
│   │   ├── greenhouses/        # 🔨 Needs API endpoints
│   │   ├── node/               # 🔨 Partial (PostSensorData exists)
│   │   ├── conditions/         # 🔨 Needs bulk-sync endpoint
│   │   ├── rules/              # ❌ Empty — needs full CRUD
│   │   ├── devices/            # ❌ Empty — needs device registry API
│   │   ├── alerts/             # ❌ Empty — needs alert system
│   │   ├── reports/            # ❌ Empty — needs aggregation
│   │   ├── sensorHistory/      # ❌ Empty — time-series queries
│   │   └── zone/               # ❌ Empty — greenhouse zones
│   └── config/                 # ✅ Settings, URLs
│
├── edge/                       # Raspberry Pi Edge Services
│   ├── api/                    # ❌ NEW — FastAPI service
│   ├── ml/                     # ❌ NEW — ML models + inference
│   ├── ingestion_service.py    # ✅ MQTT → SQLite
│   ├── actuator_dispatcher.py  # ✅ Command → MQTT
│   ├── rules_engine_example.py # 🔨 Needs DB-driven rules
│   └── models.py               # ✅ SQLAlchemy models
│
├── firmware/                   # ESP32/Pico W Code
│   ├── firmware_mqtt_example.cpp # ✅ Reference implementation
│   ├── sensor_dht22/           # ❌ NEW — Real sensor firmware
│   ├── sensor_soil/            # ❌ NEW — Soil moisture firmware
│   └── actuator_relay/         # ❌ NEW — Relay actuator firmware
│
├── network/                    # Pi Network Configuration
│   ├── config/                 # ✅ hostapd, mosquitto, dnsmasq, etc.
│   ├── scripts/                # ✅ install.sh, pairing, shedding
│   └── registry/               # ✅ devices.csv
│
├── web/                        # Next.js Dashboard
│   ├── app/                    # ✅ Pages exist, need real data
│   ├── components/             # ✅ UI components
│   └── lib/                    # ✅ API client, stores, mock data
│
└── docs/                       # ✅ Comprehensive documentation
```

**Legend:** ✅ Done | 🔨 Partial | ❌ Not started

---

## Recommended Build Order (What to Code First)

> [!IMPORTANT]
> **Start from the edges and work inward.** Get real data flowing end-to-end before polishing any single layer.

| Priority | Task | Why First |
|----------|------|-----------|
| **1** | ESP32 sensor firmware (real sensors, not example) | Can't test anything without real data |
| **2** | Edge ingestion (already done, just deploy) | Stores the data sensors produce |
| **3** | FastAPI on Pi | Everything else needs this API to get data |
| **4** | Django bulk-sync endpoint | Cloud can receive data from Pi |
| **5** | Edge sync service | Connects Pi → Cloud |
| **6** | Django CRUD endpoints (greenhouses, nodes, devices) | Dashboard needs these |
| **7** | Wire dashboard to real APIs | Replace mock data |
| **8** | DB-driven rules engine | Farmer can set rules from dashboard |
| **9** | ML data pipeline | Needs weeks of real data first |
| **10** | ML model training + edge deployment | Needs everything above working |

---

## Open Questions for Your Team

> [!IMPORTANT]
> These decisions will affect implementation. Discuss and decide early.

1. **Database for Cloud:** Stay with SQLite (current) or migrate to PostgreSQL/TimescaleDB for time-series data? *(Recommendation: PostgreSQL for cloud, keep SQLite on edge)*

2. **FastAPI on Pi — auth?** Should the Pi's FastAPI require authentication, or is it only accessible on the local network (secured by network isolation)?

3. **Real-time updates:** WebSocket (bidirectional) or SSE (server-sent events) for live sensor updates on the dashboard? Or just polling every 5-10 seconds for simplicity?

4. **Mobile app:** Is the Next.js web app sufficient, or do you need a React Native / Flutter mobile app? *(Affects Phase 2 scope significantly)*

5. **Cloud hosting:** Where will Django be deployed? (AWS, DigitalOcean, Railway, self-hosted?) This affects the sync service URLs and deployment pipeline.

6. **Crop database:** You have a comprehensive [`crop_database.md`](file:///d:/clone/pyqt/CropFit/docs/crop_database.md) — when should this be integrated as the agronomic prior for ML thresholds?

---

## Technology Stack Summary

| Component | Technology | Runs On |
|-----------|-----------|---------|
| Sub-nodes (sensors/actuators) | ESP32 + Arduino/PlatformIO + PubSubClient | ESP32-WROOM-32 |
| MQTT Broker | Mosquitto | Raspberry Pi |
| Edge Data Store | SQLite + SQLAlchemy | Raspberry Pi |
| Edge API | **FastAPI** (to build) | Raspberry Pi |
| Edge ML Inference | TFLite / ONNX Runtime | Raspberry Pi |
| Rules Engine | Python + APScheduler | Raspberry Pi |
| Cloud Backend | Django 6.1 + DRF + SimpleJWT | Cloud Server |
| Cloud Database | SQLite → PostgreSQL (recommended) | Cloud Server |
| Web Dashboard | Next.js + TypeScript + Zustand + TailwindCSS | Browser |
| Communication | MQTT (local), HTTPS (cloud sync) | All |
