# CropFit: Raspberry Pi, router, cloud, and dashboard integration

Reviewed against the updated working tree on 2026-09-30. This is an implementation plan, not a claim that the system has been deployed or tested on hardware.

## 1. Confirmed concept and project structure

The Raspberry Pi is the edge computer. It collects sensor readings, stores data locally, evaluates automation, and controls actuators. Its router connection provides internet access for outbound cloud synchronization. The remote dashboard reads from the cloud backend.

```text
ESP32 sensors -- local MQTT --> Raspberry Pi
                                 | Mosquitto
ESP32 actuators <-- local MQTT -- | SQLite + ingestion + rules/ML
                                 | FastAPI + cloud sync worker
                                 |
                         wlan0 Wi-Fi uplink
                                 |
                           Existing router
                                 |
                         Internet / HTTPS
                                 |
                         Django cloud API
                                 |
                            PostgreSQL
                                 |
                     HTTPS dashboard requests
                                 |
                       Next.js web dashboard
```

The Pi initiates HTTPS connections. Ordinary outbound router access is sufficient; a public Pi IP and router port forwarding are unnecessary for this design. The router routes packets; it does not synchronize databases. Python on the Pi performs synchronization.

Current root folders:

| Folder | Responsibility |
|---|---|
| `backend/` | Django cloud API, accounts, greenhouse/node registry, readings, rules, alerts, reports |
| `edge/` | Pi MQTT ingestion, SQLite models, FastAPI, sync worker, new rules engine |
| `firmware/` | ESP32 MQTT example and device simulator |
| `network/` | Pi access points, router uplink, DHCP, firewall, provisioning, systemd |
| `ml_models/` | Action-model training, inference, thresholds, evaluation utilities |
| `frontend_design/` | GreenNode visual dashboard, onboarding and device/action panels |
| `web/` | Separate dashboard with login, devices, rules, alerts, settings and admin |
| `docs/` | Architecture, hardware and process documentation; some completion claims are stale |
| `.review/node_edge/` | Additional review copy; use root code for the implementation |

`network/config/dhcpcd/dhcpcd-append.conf` leaves `wlan0` as the router-facing DHCP client. USB Wi-Fi interfaces use 10.0.10.1, 10.0.11.1, 10.0.12.1 and the provisioning subnet 10.0.13.1. Ethernet can also be an uplink, but the current firewall/shaping configuration explicitly references `wlan0` and must be adjusted if changing topology. Validate USB adapter AP/interface capabilities on the actual Pi.

## 2. Existing implementation and immediate blockers

1. `edge/ingestion_service.py` receives MQTT readings and commits SQLite rows with `synced=0`. It still hardcodes MQTT credentials and a relative DB path; make all Pi processes use shared configuration and one absolute database path.
2. `edge/api/services/sync_service.py` already posts readings to `/api/v1/conditions/bulk-sync/`. Defaults are 50 records every 30 seconds, configured by `edge/api/config.py` and scheduled in `edge/api/main.py`.
3. That worker also posts action logs to `/api/v1/actions/bulk-sync/`, but the cloud actions app is a scaffold and this URL is not mounted.
4. `backend/apps/conditions/views.py` sets `permission_classes = [permissions]`, where `permissions` is a module. Replace it with actual permission classes. Separate user reads from authenticated Pi writes.
5. `backend/config/permissions.py` returns a DRF `Response` from `has_permission` for a missing token. Return a boolean or raise the appropriate exception. Also resolve the conflict between arbitrary edge Bearer tokens and the default JWT authenticator; use a dedicated edge authentication class.
6. Cloud ingestion accepts unknown nodes as null, ignores the supplied greenhouse identifier, lacks event deduplication, and uses `a or b` to normalize readings, which loses valid zero values. Reject unknown identities, validate ownership, preserve zero and validate numeric values before writing.
7. Devices and greenhouses expose `AllowAny`; role-only checks elsewhere do not enforce greenhouse ownership. Scope reads and writes to the authenticated account or authenticated hub.
8. `backend/apps/reports/views.py` references nonexistent `Device.is_online`. Its latest-five-rows query is not latest-per-sensor, and its fields differ from the frontend dashboard types. Rebuild this aggregation.
9. `frontend_design/api/` calls endpoints Django does not expose and can return simulated success when the backend is unavailable. `web/` also has mock authentication/data paths. Production failures must produce real errors.
10. `web/` defaults to `/api/v1`, while Django auth lives under `/api/auth/`; login and refresh URL composition is inconsistent. The backend uses username login, while `web/` submits email. Backend role `tech` also differs from frontend `technician`.
11. `web/` has a WebSocket client, but Django ASGI currently serves HTTP only. A receiving actuator update also calls the store method that sends a command: split incoming-state handling from outgoing commands before enabling sockets.
12. The updated `edge/api/main.py` schedules `edge/rules_engine.py`. However, model import paths depend on the working directory, absent inputs receive fabricated defaults, actuator IDs are hardcoded, and commands use `duration_m` while the firmware example documents `duration_s`. Normalize units and sensor keys (`temperature`/`humidity` versus `air_temp`/`rh`) explicitly.
13. The rules engine skips OFF/CLOSED commands and creates a new MQTT dispatcher each scheduled run. Implement stop transitions, reuse/close clients, and enforce minimum intervals and maximum run times. A queued MQTT publish is not proof of execution.
14. `network/systemd/greennode-rules.service` still starts `rules_engine_example.py`. Choose one automation runner and add a managed FastAPI/sync service; avoid running both rule engines or duplicating schedulers across API workers.

## 3. Identity, ownership and data model

Use `GreenHouse` for the growing site, `Node` for the Pi hub, and `Device` for an attached sensor/actuator. Frontend code currently sometimes calls the hub a device; map this explicitly instead of conflating IDs.

Extend the existing models with:

| Model | Required data |
|---|---|
| Node | stable public ID, greenhouse owner relationship, firmware version, last heartbeat, desired/reported operating mode, applied configuration version |
| HubCredential | hub relationship, credential identifier, hashed secret, expiry/revocation and rotation metadata |
| HubClaim | one-time activation-code hash, expiry, claimed account and claim timestamp |
| ConditionReading | stable event UUID, node/device relationship, measured time, edge receipt time, cloud receipt time, schema version, validated metrics and quality flags |
| Device | capabilities, enabled/revoked state, last seen, firmware, calibration metadata; decide how existing Sensor/Actuator models reference this registry |
| Command | UUID, node/device, requested action, bounded duration, expiry, creator, idempotency key, lifecycle and failure reason |
| ActionEvent | stable event UUID, optional command ID, rule/model source, dispatched/acknowledged/completed state and timestamps |
| HubHealth | last successful sync, pending record count, oldest queued record age, disk status, MQTT status and applied configuration version |
| Rule configuration | versioned desired configuration, crop/growth-stage thresholds, explicit priorities and actuator capability mapping |

Use database uniqueness on `(node, event_id)`. Keep desired actuator state separate from device-reported state. Unknown state must remain unknown.

Cloud owns accounts, claims and desired configuration. Pi owns observed readings, actual device state and local execution events. Cloud changes are requests that the Pi validates and acknowledges. This avoids two independent systems overwriting the same state.

## 4. Reliable upload protocol

Keep HTTPS batch uploads as the initial internet transport; they already exist in this project. Keep MQTT between the Pi and local devices.

Proposed extension to the existing telemetry endpoint:

```json
{
  "schema_version": 1,
  "node_id": "pi-edge-hub-01",
  "readings": [{
    "event_id": "f42715ec-85fa-42b1-940a-9f8dba59c891",
    "device_id": "esp32-climate-01",
    "reading_ts": 1790726400,
    "received_ts": 1790726401,
    "payload": {"temperature": 28.4, "humidity": 71.2}
  }]
}
```

Authenticate the credential and derive the allowed node from it. Verify any supplied node ID matches. Derive the greenhouse server-side. Validate that each device belongs to that node.

Cloud response after durable commit:

```json
{
  "accepted_event_ids": ["f42715ec-85fa-42b1-940a-9f8dba59c891"],
  "duplicate_event_ids": [],
  "rejected": []
}
```

The Pi marks only accepted or already-existing events as synced. Persist each UUID when the reading is first stored and reuse it on retries. Also deduplicate local MQTT deliveries using a device event ID or boot-ID/sequence pair; assigning a new Pi UUID to each duplicate MQTT delivery is insufficient.

Required worker behavior:

- Timeout or HTTP 5xx: retain rows and retry with capped exponential backoff plus jitter.
- HTTP 429: respect server retry guidance. HTTP 401/403: report credential failure and slow/pause retries until credentials are repaired.
- Invalid rows: quarantine with error details; allow valid rows to progress. Specify partial acceptance in the contract.
- A lost response after cloud commit causes safe replay, not duplicate history.
- Reset per-attempt error state; the existing worker can retain an old network-error status after a successful upload.
- Order queued events deterministically and drain multiple bounded batches when catching up. A single batch of 50 every 30 seconds only clears about 1.67 records/second; size throughput above the actual ingest rate.
- Separate telemetry, actions, inventory and health progress so one failing stream cannot block the others.
- Reserve capacity for fresh health/state while sending historical backlog. Older replayed readings must not replace newer current readings.
- Set disk limits and retention explicitly. Prune acknowledged history first; report queue pressure before dropping unsent data. State any overflow policy to the operator.
- Use one sync worker, durable SQLite storage, restart-safe transactions and consistent DB settings. Exercise power-loss recovery.

Pi configuration example, with placeholders only:

```dotenv
NODE_ID=pi-edge-hub-01
GREENHOUSE_ID=greenhouse-01
CLOUD_BACKEND_URL=https://api.example.com
CLOUD_SYNC_TOKEN=<unique-credential-for-this-hub>
SYNC_BATCH_SIZE=100
SYNC_INTERVAL_SECONDS=30
DB_URL=sqlite:////var/lib/greennode/greennode.db
```

The worker appends `/api/v1/...`, so `CLOUD_BACKEND_URL` must be the origin without that suffix. `127.0.0.1` on the Pi refers to the Pi itself, not the cloud. The proposed per-hub credential must be implemented on Django before this example is usable.

## 5. API interfaces to implement or repair

Paths below are proposed contracts unless marked existing. Use trailing slashes consistently.

| Caller | Method and path | Purpose/status |
|---|---|---|
| Browser | POST `/api/auth/token/`, POST `/api/auth/token/refresh/`, GET `/api/auth/me/` | Existing; align frontend username, user and token shapes |
| Browser | POST `/api/v1/hubs/claim/` | Claim a pre-provisioned hub using a one-time code |
| Browser | GET `/api/v1/greenhouses/` | Existing; add ownership filtering |
| Browser | GET `/api/v1/hubs/` and GET `/api/v1/hubs/{id}/` | Owned hubs and selected hub details |
| Browser | GET `/api/v1/hubs/{id}/health/` | Freshness, last seen, queue and connectivity |
| Browser | GET `/api/v1/hubs/{id}/devices/` | Registered peripherals and capabilities |
| Browser | GET `/api/v1/greenhouses/{id}/dashboard/` | Stable metrics, current states, thresholds, growth stage and alerts |
| Browser | GET `/api/v1/conditions/readings/` | Existing; fix permissions, scoped filters and cursor/time-window pagination |
| Browser | POST `/api/v1/hubs/{id}/commands/` | Queue actuator, mode, pairing or supported sleep requests; return 202 and command ID |
| Browser | GET `/api/v1/commands/{id}/` | Command progress and observed result |
| Browser | GET/PATCH `/api/v1/rules/...` | Existing foundation; align ownership, editing roles, shape and versioning |
| Browser | PATCH `/api/v1/alerts/{id}/acknowledge/` | Existing PATCH; `web/` currently sends POST |
| Browser | GET `/api/v1/hubs/{id}/recommendations/` | Pi-generated recommendations, reasons, input freshness and model/rule version |
| Pi | POST `/api/v1/conditions/bulk-sync/` | Existing; repair identity, validation and idempotency |
| Pi | POST `/api/v1/actions/bulk-sync/` | Missing; execution history and command outcome events |
| Pi | POST `/api/v1/devices/sync/` | Existing receiver; add authenticated edge sender and ownership checks |
| Pi | POST `/api/v1/edge/heartbeat/` | Missing; status, version, queue depth and cloud last-seen |
| Pi | POST `/api/v1/edge/commands/claim/` | Missing; lease pending unexpired commands for this authenticated hub |
| Pi | POST `/api/v1/edge/commands/{id}/events/` | Missing; idempotent acknowledgements and outcomes |
| Pi | GET `/api/v1/edge/config/` | Missing; scoped versioned rules, thresholds, capabilities and desired mode |

Retain existing routes during migration. Existing node routing currently produces `/api/v1/nodes/nodes/`; introduce a clean hub-facing route without silently breaking old callers.

Device sync must not let the Pi undo a cloud revocation. Keep cloud desired revocation separate from edge reported inventory. Fix the current rules export selection so greenhouse-specific rules cannot leak through its broad `node is null` branch.

## 6. Remote commands through the router

1. User requests a bounded action in the dashboard.
2. Django checks greenhouse access and device capability, persists a command and returns `202 queued`.
3. Pi polls the cloud over outbound HTTPS, initially every 2–5 seconds while online, and claims a short lease on pending commands.
4. Pi durably records the command ID before local dispatch; rejects expired commands and applies local interlocks.
5. Pi publishes a non-retained MQTT command containing its ID, desired state and expiry.
6. Firmware deduplicates command IDs, validates supported actions/durations and reports acknowledgement plus actual state.
7. Pi uploads command events. The dashboard shows queued, received, running, completed, failed, expired or unknown according to evidence.

Persist the command ledger on both sides and make state transitions monotonic. On a crash between physical execution and recording acknowledgement, query device state and reconcile rather than blindly replaying a timed irrigation action. Exactly-once physical execution cannot be inferred from an HTTP/MQTT success response.

Expired commands must not execute after an outage. Remote control is unavailable while the Pi is offline; the cloud UI should show this. Local automation continues under the last acknowledged configuration. Manual override needs explicit priority and expiry, and local stop timers must work without cloud access.

## 7. Dashboard wiring and missing user interfaces

Both frontends remain present. Proposed default: use `frontend_design/` as the main visual interface, port useful rules/alerts/admin flows from `web/`, and maintain one shared API contract. This is a planning assumption, not a completed consolidation.

Replace the hardcoded hub ID with selection from the user's claimed hubs. Adapt cloud snake_case responses in one typed API layer, or generate types from an OpenAPI schema. Avoid parallel handwritten incompatible contracts.

| Existing panel / new screen | Work required |
|---|---|
| Login and onboarding | Real auth errors, token refresh, restore session, hub claim and greenhouse assignment; decide invite/admin registration versus public signup |
| Hub selector | Account-owned greenhouse/hub list; persist selection safely and clear it on logout |
| DeviceManagementZone | Health and inventory queries; save renaming; show actual last-seen, firmware and configuration version |
| AddDeviceModal | Replace generated local IDs with a pairing session, discovery results, selected device approval and Pi acknowledgement |
| GreenhouseMonitorZone | Fetch latest per sensor/metric with numeric values, units, observation times and stale flags; include real timestamped history |
| ActionPanelZone | Real growth-stage configuration, thresholds, recommendations and tracked command requests |
| ManualOverride | Replace timer-only feedback with duration entry, capability checks, stop action and command progress |
| Mode/sleep controls | Persist desired state, wait for reported state; unsupported sleep/wake remains unavailable |
| Sync diagnostics | Router/internet/cloud status, last successful upload, queue depth, oldest backlog, error and recovery status |
| History | Time-range charts and event history scoped to greenhouse/device; aggregate large windows |
| Rules and thresholds | Create/edit/version configurations, show pending versus Pi-applied changes |
| Alerts and actions | Separate alarm acknowledgement, resolution and command execution history |
| Calibration/settings | Sensor units and calibration, hub configuration, credentials lifecycle and access management |

Start with HTTP polling every 5–10 seconds on visible pages, then add push if required. A 30-second edge upload period cannot support a true one-second cloud freshness label. Display observation time and last cloud sync rather than a hardcoded `Sync: 1s`.

Missing metrics must be null/unavailable, never synthetic healthy values. Define soil moisture percentages separately from the current UI's unspecified SCI score. Do not equate lux, PAR and daily light integrals without a defined conversion/calibration model.

Remove automatic mock fallbacks from production authentication and control paths. Keep demos behind an explicit isolated demo setting. Refresh rotation must store any returned new refresh token. Use a server-managed secure session/cookie layer for production browser auth, with CSRF protection where applicable, and keep hub credentials exclusively on the Pi/server.

Optional WebSocket phase: add Channels protocol routing, authentication, allowed-origin checks, greenhouse-scoped consumers and a production channel layer. Push committed updates only; refetch a snapshot on reconnect so missed events do not permanently stale the UI. No WebSocket is required to prove the first end-to-end sensor flow.

## 8. Deployment and validation order

| Phase | Deliverables | Acceptance gate |
|---|---|---|
| 1. Contracts and identity | Stable IDs/units, auth fixes, ownership, hub claim, frontend DTO agreement | User A cannot read/control User B's hub; invalid credentials fail visibly |
| 2. Telemetry vertical slice | Repair cloud ingestion, per-hub credentials, event IDs, acknowledged retries | Simulated sensor -> Pi SQLite -> router -> cloud -> dashboard metric |
| 3. Operational UI | Health/inventory heartbeat, hub selection, real history and stale states | Actual hub offline/online and backlog status shown accurately |
| 4. Commands and feedback | Command queue, Pi polling, firmware ack/state, action sync | One requested action executes once; duplicate delivery and lost responses do not extend it |
| 5. Automation/configuration | Correct import paths, field mapping, persistent runner, rules versioning, overrides and stop behavior | Rules operate offline; missing/stale sensor inputs do not trigger fabricated decisions |
| 6. Remaining screens and push | Pairing/calibration/rules/alerts/settings; optional Channels | All visible controls persist or clearly report unsupported behavior |
| 7. Cloud/Pi operations | HTTPS, PostgreSQL, process supervision, monitoring, backups and recovery runbook | Reboot, internet outage and cloud restore tests pass |

For the initial cloud deployment, use a production Django server behind an HTTPS reverse proxy, PostgreSQL on a private connection, and the selected Next.js frontend. Prefer a single public origin with `/api/` routed to Django; if using separate origins, configure explicit CORS origins. Keep DEBUG disabled, explicit allowed hosts, secrets outside Git, migration/backup procedures, health checks and log rotation.

On the Pi, supervise Mosquitto, ingestion and the API/worker under systemd with explicit working directories and restart policy. Package model/config paths relative to installed files. Keep sync running even when ML fails; model import failure currently risks preventing API startup. Use one scheduler process and disable the legacy example timer when enabling the replacement.

Critical tests before declaring completion:

- Router internet unavailable for an hour: local readings and control continue; backlog survives reboot and drains without duplicates.
- Cloud commits a batch but the response is lost: replay changes no event count.
- Unknown/revoked hub, foreign device ID and cross-account access: denied.
- Zero readings, malformed payloads, clock skew and delayed history: handled without corrupting current values.
- Duplicate command, MQTT reconnect, Pi crash and expired irrigation command: no unsafe replay or timer extension.
- Actuator stops at its local deadline even if Pi/cloud disconnects.
- Failed login and failed API requests never appear as demo success in production.
- Invalid/new configuration is rejected atomically and the last good version remains usable.
- Database backup restore and bounded queue/disk-pressure behavior are exercised.

## 9. Implementation file map

- Cloud: repair `backend/config/permissions.py`, settings and URLs; extend conditions/devices/node models and migrations; implement `backend/apps/actions/`; add hub credentials/claims/health/configuration/command services; rebuild reports/dashboard aggregation.
- Pi: update `edge/api/services/sync_service.py`; add command and config clients; extend `edge/models.py` with event IDs and command ledger; centralize config in ingestion; repair `edge/rules_engine.py`; add MQTT state/ack ingestion and firmware capability mapping.
- Firmware: add durable/recoverable command deduplication, bounded actuator timers and state reporting to the real device implementation, beyond the current example sketch.
- UI: update `frontend_design/api/{client,auth,device,types}.ts`, stores and dashboard handlers; implement the screen flows listed above. If `web/` is retained, apply the same contract there and fix its inbound-event/outbound-command coupling.
- Operations: update `network/systemd/` and installer paths; add deployment/environment examples, OpenAPI schema and integration tests. Reconcile older docs after the implementation is verified.

Official references: [DRF permissions and ownership](https://www.django-rest-framework.org/api-guide/permissions/), [Django deployment checklist](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/), [Channels protocol routing](https://channels.readthedocs.io/en/stable/topics/routing.html), [MQTT protocol semantics](https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html). Role permissions do not automatically filter list results; deployment needs production settings; WebSocket support needs explicit routing; MQTT delivery acknowledgement does not establish physical actuator execution.
