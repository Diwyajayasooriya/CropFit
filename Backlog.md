# Green Node — XP Project Backlog & Work Division
**Team: BlueCircle | Methodology: Extreme Programming (XP)**
Members: Abeykoon A.M.S.D. (Dew), Jayasooriya J.A.D.N., Perera I.S.A., Ashen K.D., Rathnayake R.M.S.N.

---

## How to use this backlog

This is organized as **7 epics** that map to Green Node's architecture layers (hub hardware, sub-node integration, networking, backend, AI/ML, admin panel, mobile app). Each epic has a set of **user stories** written in standard XP/agile format, with acceptance criteria and a rough story-point estimate (Fibonacci: 1, 2, 3, 5, 8).

Since you're running this XP-style:
- Work in **short iterations** (suggest 1–2 week iterations given a student team's part-time availability).
- Stories are sized so a pair (or solo dev) can realistically finish one in an iteration.
- **Pair programming is encouraged** across epics that touch each other (e.g., whoever does MQTT broker setup should pair briefly with whoever does sub-node firmware, since that's the integration seam).
- Members can pick stories freely based on interest/skill — the epics are *not* rigid 1-person-per-epic assignments, though the natural split is roughly 5 epics ↔ 5 people if everyone wants one lane.
- Remember: **ESP32/Pico W sub-nodes are third-party, farmer-sourced hardware.** Any story here about "sub-nodes" means building Green Node's *interface/integration* with them, never designing or manufacturing the sub-node hardware itself.

---

## Epic Overview

| Epic | Focus | Core Tech | Suggested Owner Profile |
|---|---|---|---|
| A | Hub Hardware & OS | Raspberry Pi 4/5, Linux | Hardware-inclined |
| B | Sub-node Integration Layer | ESP32 (example), MQTT | Hardware + firmware-inclined |
| C | Networking & Security | hostapd, dnsmasq, nftables | Networking-inclined |
| D | Backend & Data | FastAPI, MQTT broker, TimescaleDB | Backend dev |
| E | AI/ML Inference | TFLite / ONNX Runtime | ML-inclined |
| F | Admin Panel (Web/Desktop) | Electron + React | Frontend dev |
| G | Mobile App | React Native | Frontend/mobile dev |

---

## EPIC A — Hub Hardware & OS Setup (Raspberry Pi 4)

### A1. Base OS provisioning
**As a** developer, **I want** a standardized Raspberry Pi OS image with all base dependencies pre-installed, **so that** every team member can flash an identical hub environment without manual setup drift.
- Acceptance criteria: headless boot via SSH; static hostname; Python/Node runtimes installed; documented flashing steps.
- Est: 3

### A2. GPIO/peripheral boundary definition
**As a** system architect, **I want** clear documentation of what the Pi 4 hub does and does not touch physically (no direct sensor wiring — that's sub-node territory), **so that** the hardware boundary between hub and third-party sub-nodes stays clean.
- Acceptance criteria: a short architecture note confirming hub has no GPIO sensor wiring dependency; hub communicates only over network (MQTT/HTTP).
- Est: 1

### A3. Local failsafe watchdog on hub
**As a** farmer, **I want** the hub to detect its own downtime and log/alert it, **so that** I know when sub-node local failsafes have kicked in.
- Acceptance criteria: watchdog service restarts hung services; downtime event logged to TimescaleDB; boot self-check script.
- Est: 5

### A4. Power & enclosure resilience spec
**As a** hardware lead, **I want** a documented power supply and enclosure spec (surge protection, greenhouse humidity tolerance), **so that** the hub survives real greenhouse conditions.
- Acceptance criteria: written spec sheet with recommended PSU rating, enclosure IP rating, thermal notes.
- Est: 2

### A5. Hub bring-up test rig
**As a** QA-minded developer, **I want** a repeatable smoke-test script that verifies networking, MQTT broker, backend, and DB are all up after boot, **so that** hardware bring-up failures are caught immediately.
- Acceptance criteria: single script/systemd check exits non-zero on any subsystem failure; results logged.
- Est: 3

---

## EPIC B — Sub-node Integration Layer (ESP32 example)

### B1. Reference sub-node firmware (example only, not shipped hardware)
**As a** developer, **I want** an example ESP32 firmware sketch that publishes sensor readings over MQTT in Green Node's expected payload schema, **so that** the team has a working reference for how any third-party sub-node should talk to the hub.
- Acceptance criteria: ESP32 publishes JSON payload (sensor type, value, timestamp, node ID) to a defined topic; documented as "reference/example," not a BlueCircle product.
- Est: 5

### B2. MQTT topic & payload schema definition
**As a** backend developer, **I want** a versioned topic naming convention and JSON schema for sensor data and actuator commands, **so that** any third-party manufacturer's sub-node can integrate predictably.
- Acceptance criteria: schema doc covering `sensors/{type}/{node_id}`, `actuators/{type}/{node_id}/cmd`, `actuators/.../ack`; includes versioning field.
- Est: 3

### B3. Sub-node registration/discovery flow
**As a** farmer, **I want** newly connected third-party sub-nodes to be auto-discovered by the hub, **so that** I don't have to manually configure each device.
- Acceptance criteria: hub listens on a discovery topic; new node auto-registers in DB with default metadata; appears in admin panel.
- Est: 5

### B4. Local failsafe threshold handshake
**As a** farmer, **I want** sub-nodes to receive and store safe fallback thresholds from the hub, **so that** irrigation/actuators keep working safely if the hub goes offline.
- Acceptance criteria: hub pushes threshold config to sub-node on connect; example ESP32 firmware demonstrates local fallback logic when MQTT connection drops.
- Est: 5

### B5. Actuator command acknowledgement loop
**As a** system operator, **I want** every actuator command to be acknowledged by the sub-node, **so that** the hub knows if a command (e.g., open irrigation valve) actually executed.
- Acceptance criteria: command → ack round trip logged; timeout triggers a retry/alert.
- Est: 3

---

## EPIC C — Networking & Security

### C1. Multi-SSID hostapd configuration
**As a** network admin, **I want** three isolated virtual SSIDs (sensors / actuators / admin) broadcast from the hub, **so that** different device classes are network-segmented for security.
- Acceptance criteria: hostapd config with 3 virtual BSS interfaces confirmed broadcasting; each SSID authenticates independently.
- Est: 5

### C2. Per-slice DHCP via dnsmasq
**As a** network admin, **I want** each SSID slice to hand out IPs from its own subnet, **so that** device classes can't collide on the network.
- Acceptance criteria: 3 subnets configured; dnsmasq leases confirmed per interface; lease log accessible.
- Est: 3

### C3. Inter-slice isolation via nftables
**As a** security-conscious developer, **I want** nftables rules that block cross-subnet traffic except explicitly allowed hub services, **so that** a compromised sensor can't reach the admin network.
- Acceptance criteria: ruleset tested — sensor subnet cannot ping/reach admin subnet; hub services (MQTT broker, API) remain reachable from all slices as needed.
- Est: 5

### C4. MQTT broker access control
**As a** security lead, **I want** per-topic ACLs and authentication on the MQTT broker, **so that** sub-nodes can only publish/subscribe to their own topics.
- Acceptance criteria: broker requires credentials; ACL file restricts topic access by client; unauthorized publish attempt is rejected and logged.
- Est: 3

### C5. Remote access / VPN for farmer support
**As a** farmer, **I want** a secure way for support staff to remotely access my hub if something goes wrong, **so that** I don't need on-site technical visits for every issue.
- Acceptance criteria: documented secure remote access method (e.g., WireGuard or SSH tunnel); access is logged and revocable.
- Est: 5

---

## EPIC D — Backend & Data

### D1. FastAPI service skeleton
**As a** developer, **I want** a FastAPI backend scaffold with routing, auth middleware, and MQTT client integration, **so that** all other backend features build on a consistent base.
- Acceptance criteria: `/health` endpoint live; MQTT client subscribes and forwards messages into the app; basic JWT auth stub.
- Est: 5

### D2. TimescaleDB schema for sensor time-series
**As a** data engineer, **I want** a TimescaleDB hypertable schema for sensor readings, **so that** historical greenhouse data can be queried efficiently.
- Acceptance criteria: hypertable created with node_id, sensor_type, value, timestamp; basic retention/compression policy documented.
- Est: 3

### D3. Ingestion pipeline: MQTT → DB
**As a** backend developer, **I want** incoming MQTT sensor messages automatically written to TimescaleDB, **so that** no manual step is needed to persist data.
- Acceptance criteria: message received on sensor topic appears in DB within 1s; malformed payloads are rejected and logged, not crashing the pipeline.
- Est: 5

### D4. Command dispatch API
**As an** admin panel/mobile app developer, **I want** a REST endpoint that publishes actuator commands to the correct MQTT topic, **so that** the frontend can control irrigation, lights, etc.
- Acceptance criteria: `POST /actuators/{id}/command` publishes to correct topic; returns pending status until ack received.
- Est: 3

### D5. User & farm/greenhouse management API
**As a** farmer, **I want** to manage my account and register multiple greenhouses/hubs, **so that** I can scale to more than one greenhouse over time.
- Acceptance criteria: CRUD endpoints for users, farms, hubs; role-based access (farmer vs admin).
- Est: 5

### D6. Alerting/notification service
**As a** farmer, **I want** to be notified when a sensor reading crosses a critical threshold or a sub-node goes offline, **so that** I can react before crop damage occurs.
- Acceptance criteria: threshold-breach event generates a notification record; hook point ready for email/push/SMS later.
- Est: 3

---

## EPIC E — AI/ML Inference Layer

### E1. Data preprocessing pipeline for model input
**As a** ML engineer, **I want** a pipeline that cleans and windows time-series sensor data from TimescaleDB, **so that** it's ready to feed into inference models.
- Acceptance criteria: script pulls last N minutes/hours of data per sensor type, handles missing values, outputs model-ready tensors.
- Est: 5

### E2. Baseline rule/threshold-based control model
**As a** farmer, **I want** a simple baseline automation (e.g., "if soil moisture < X, open valve") running before any ML model is ready, **so that** the greenhouse has working automation from day one.
- Acceptance criteria: baseline rules configurable via admin panel; runs independently of ML layer; used as fallback comparator.
- Est: 3

### E3. TFLite/ONNX model integration into hub
**As a** ML engineer, **I want** a trained model exported to TFLite or ONNX and loaded into a hub inference service, **so that** the hub can make predictive control decisions locally.
- Acceptance criteria: model loads on hub boot; inference runs on a sample input within acceptable latency (sub-second, given minutes-scale control loop tolerance); output logged.
- Est: 8

### E4. Predictive irrigation/climate control model (first use case)
**As a** farmer, **I want** the AI layer to predict optimal irrigation timing based on recent sensor trends, **so that** water use is optimized rather than purely reactive.
- Acceptance criteria: model trained on sample/synthetic dataset; produces irrigation recommendation; compared against baseline rule model for sanity.
- Est: 8

### E5. Model versioning & retraining hook
**As a** ML engineer, **I want** a simple way to swap in a newer model version without redeploying the whole hub software, **so that** models can improve iteratively as more farm data is collected.
- Acceptance criteria: model files are versioned/named; hub config points to active version; swap requires only a config change + service restart.
- Est: 3

### E6. Inference decision logging & explainability note
**As a** farmer, **I want** to see *why* the AI made a recommendation (which sensor readings triggered it), **so that** I can trust or override the automation.
- Acceptance criteria: each AI decision logged with the input feature snapshot that produced it; surfaced via API for the admin panel to display.
- Est: 5

---

## EPIC F — Admin Panel (Electron + React, web & desktop)

### F1. Admin panel shell & auth
**As a** farmer, **I want** to log into a desktop/web admin panel, **so that** I have a central place to monitor and control my greenhouse.
- Acceptance criteria: Electron + React app scaffolded; login flow against FastAPI JWT auth; basic navigation shell (dashboard, devices, alerts, settings).
- Est: 5

### F2. Live sensor dashboard
**As a** farmer, **I want** to see real-time sensor readings (temperature, humidity, soil moisture, CO₂) on a dashboard, **so that** I can monitor greenhouse conditions at a glance.
- Acceptance criteria: dashboard polls/streams latest values per sensor; simple charts for recent trend; updates without full page reload.
- Est: 5

### F3. Sub-node management screen
**As a** farmer, **I want** to see all connected third-party sub-nodes, their status (online/offline), and last-seen time, **so that** I can spot connectivity issues quickly.
- Acceptance criteria: table/list view of registered sub-nodes; status badge; manual "rename/remove" actions.
- Est: 3

### F4. Actuator control panel
**As a** farmer, **I want** to manually trigger actuators (irrigation valve, grow lights) from the admin panel, **so that** I can override automation when needed.
- Acceptance criteria: buttons/toggles call the command dispatch API; UI reflects ack/pending/failed states.
- Est: 3

### F5. Alerts & notification center
**As a** farmer, **I want** a dedicated view of past and active alerts, **so that** I can review what went wrong and when.
- Acceptance criteria: list of alerts with timestamp, severity, related sensor/node; mark-as-read functionality.
- Est: 3

### F6. AI recommendation & explainability view
**As a** farmer, **I want** to see the AI's current recommendations and the reasoning behind them, **so that** I can decide whether to accept or override them.
- Acceptance criteria: displays E6's logged decision data in a readable format; accept/override buttons wired to backend.
- Est: 5

---

## EPIC G — Mobile App (React Native)

### G1. Mobile app shell & auth
**As a** farmer, **I want** to log into a mobile app with the same account as the admin panel, **so that** I can check my greenhouse from anywhere.
- Acceptance criteria: React Native app scaffolded; shares auth flow/API with backend; basic tab navigation.
- Est: 5

### G2. Mobile sensor overview
**As a** farmer, **I want** a simplified mobile view of key sensor readings, **so that** I can quickly check greenhouse status on my phone.
- Acceptance criteria: condensed dashboard with current values for key sensors; pull-to-refresh.
- Est: 3

### G3. Push notifications for critical alerts
**As a** farmer, **I want** to get a push notification if something critical happens (e.g., irrigation failure, hub offline), **so that** I don't have to keep the app open to know.
- Acceptance criteria: push notification triggers on critical alert events; tapping opens the relevant alert detail screen.
- Est: 5

### G4. Remote actuator quick-control
**As a** farmer, **I want** to trigger key actuators from my phone in an emergency, **so that** I can respond even when I'm not near the greenhouse.
- Acceptance criteria: mobile quick-action buttons call the same command dispatch API as the admin panel; confirmation dialog before firing.
- Est: 3

---

## Suggested First Iteration (Iteration 0 / Spike)

Before diving into feature stories, XP favors a short spike to de-risk integration. Suggested Iteration 0 stories (one from each epic, smallest ones):
- A1 (Base OS provisioning)
- B2 (MQTT topic & payload schema — do this early, everyone depends on it)
- C1 (Multi-SSID hostapd config)
- D1 (FastAPI service skeleton)
- E2 (Baseline rule-based control — gives a working demo fast)

This gives the team a thin vertical slice (sensor → network → backend → basic automation) working end-to-end before layering AI and polished UI on top — a very XP way to start (working software early, iterate from there).

## Notes on Team Practices (XP-aligned)
- **Collective code ownership:** anyone can touch any epic's code; the epic split above is about *initial* ownership/interest, not walls.
- **Continuous integration:** set up a shared repo with CI running on every push (lint + basic tests) as soon as Iteration 0 stories land.
- **Pair on integration seams:** B (sub-node) ↔ D (backend ingestion), and E (AI) ↔ D (data pipeline) are the two riskiest seams — pair across those epics rather than working in isolation.
- **Small releases:** aim to demo a working (even if ugly) end-to-end flow after every iteration, not just at the end of the project.
