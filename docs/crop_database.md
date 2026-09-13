# GreenNode — Database Design

This document describes the two-tier database architecture for GreenNode: a **cloud/admin tier** (source of truth, cross-user, used for ML) and an **edge/local tier** (runs on the GreenNode hub itself, real-time, must survive disconnection from the cloud).

The split exists because control-loop decisions have to keep working even when the hub loses internet access — sensors and actuators can't wait on a round trip to the cloud, but the cloud still needs a complete, aggregated picture across every deployed hub for reporting and for training the rule-derivation model.

---

## 1. Architecture at a glance

```
                    ┌─────────────────────────────────────────┐
                    │           CLOUD / ADMIN TIER             │
                    │        (PostgreSQL + TimescaleDB)        │
                    │                                           │
                    │  user_authentication                      │
                    │  nodes                                    │
                    │  conditions   (hypertable, ML training)   │
                    │  rules        (derived from conditions)   │
                    │  node_rules   (which rules run where)     │
                    └───────────────▲───────────────────────────┘
                                    │  batch sync (periodic push)
                                    │  rule pull  (periodic pull)
                    ┌───────────────┴───────────────────────────┐
                    │            EDGE / LOCAL TIER               │
                    │         (SQLite, on the RPi4 hub)          │
                    │                                             │
                    │  node_identity     (factory-code identity)  │
                    │  connected_devices (paired sub-node allowlist) │
                    │  conditions        (real-time sensor log)   │
                    │  node_rules_cache  (offline rule copy)      │
                    │  actions_log       (actuator command audit) │
                    └─────────────────────────────────────────────┘
```

---

## 2. Cloud / Admin tier

Owned and maintained centrally. This is the platform's system of record — used for cross-hub reporting, user management, and as the training dataset for rule derivation.

### `user_authentication`
| Field | Type | Notes |
|---|---|---|
| user_id | uuid, PK | |
| email | string, unique | |
| password_hash | string | never store plaintext |
| role | string | farmer / admin / support |
| mfa_enabled | boolean | |
| last_login_at | timestamp | |
| created_at | timestamp | |

### `nodes`
Registry of every physical GreenNode hub deployed across all users.

| Field | Type | Notes |
|---|---|---|
| node_id | uuid, PK | shared with `local_node.node_id` on the hub |
| owner_user_id | uuid, FK → user_authentication | |
| node_type | string | hardware/model revision |
| label | string | farmer-facing name |
| location | string | address or lat/long |
| firmware_version | string | |
| status | string | online / offline / maintenance |
| last_seen_at | timestamp | |
| installed_at | timestamp | |

### `conditions` (TimescaleDB hypertable, partitioned by time)
The large greenhouse-conditions dataset used for ML. This is an aggregate/append-only log fed by every hub's `condition_db`.

| Field | Type | Notes |
|---|---|---|
| reading_id | bigserial | |
| node_id | uuid, FK → nodes | |
| ts | timestamp | hypertable time column |
| temperature, humidity, soil_moisture, light, co2 | float | extend as sensor types grow |
| action_taken | json | nullable — what the system did in response, if anything |
| source | string | `sensor_realtime` \| `aggregated` |

### `rules`
Rules mined from `conditions` (see §5). Not tied to one node — a rule is defined per crop type / node type and can be reused across many hubs.

| Field | Type | Notes |
|---|---|---|
| rule_id | uuid, PK | |
| crop_type / node_type | string | what context the rule applies to |
| condition | json | e.g. `{"temperature": {"op": ">", "value": 32}}` |
| action | json | e.g. `{"device_type": "fan", "command": "on"}` |
| priority | int | resolves conflicts when multiple rules fire |
| confidence / support | float | training metrics from the model |
| model_version | string | |
| status | string | draft / active / deprecated |

### `node_rules` (junction table)
**This was the missing piece in the original design.** A node can run several rules, and a rule can be installed on many nodes — that's a many-to-many relationship, which needs its own table rather than a direct `nodes ↔ rules` link.

| Field | Type | Notes |
|---|---|---|
| node_id | uuid, FK → nodes | |
| rule_id | uuid, FK → rules | |
| installed_at | timestamp | |
| active | boolean | lets you disable a rule on one node without deleting it globally |

---

## 3. Edge / Local tier — Node Database Implementation

This section is the **actual build** of the single-node edge database — what runs on one GreenNode hub, in SQLite, on the RPi4 itself. It supersedes the earlier `local_user` / `local_node` sketch: a single hub doesn't need a multi-row "nodes" abstraction locally, it needs its own durable identity, its own allowlist of paired sub-devices, and a lean operational log. Cloud-side bookkeeping (owner, billing, fleet status) stays where it belongs — in the cloud tier's `nodes` and `user_authentication` tables.

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous  = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
```

WAL mode lets the ingestion writer and the rule-evaluation reader work concurrently without locking each other out. `synchronous = NORMAL` trades a sliver of durability for meaningfully better write throughput on high-frequency sensor telemetry. `busy_timeout` absorbs the brief contention that comes from SQLite's single-writer limit. `foreign_keys = ON` is required because SQLite doesn't enforce FK constraints by default.

### `node_identity`
The hub's own durable identity — set once at provisioning, never overwritten by normal app logic. Enforced as a **single row** via the `CHECK (id = 1)` constraint. This is what lets the cloud (and a human, physically) verify "this data really came from this device."

| Field | Type | Notes |
|---|---|---|
| id | integer, PK | always `1` — enforces single-row table |
| node_uid | text, unique | the node's factory code — a random UUIDv4 generated at first boot; this is what goes out in every synced row and rule reference |
| hardware_serial | text | the RPi4's own CPU serial (read from `/proc/cpuinfo`), kept for physical cross-verification against `node_uid` |
| firmware_version | text | |
| provisioned_at | timestamp | |

```python
import uuid

def provision_node(db_conn):
    node_uid = str(uuid.uuid4())
    hw_serial = get_cpu_serial()  # reads 'Serial' line from /proc/cpuinfo
    db_conn.execute(
        "INSERT INTO node_identity (id, node_uid, hardware_serial) VALUES (1, ?, ?)",
        (node_uid, hw_serial)
    )
```
Runs once, guarded by "only if `node_identity` is empty" — not on every app start.

### `connected_devices`
The allowlist of third-party sensors/actuators (ESP32, Pico W, etc.) this hub trusts. **This is the enforcement point** — a device must be paired (inserted here) before any of its readings or command receipts are accepted, which prevents a rogue or misconfigured sub-node from injecting fake data.

| Field | Type | Notes |
|---|---|---|
| device_id | text, PK | sub-node's own hardware-reported ID (MAC address or chip ID) |
| device_type | string | `sensor` \| `actuator` |
| label | string | human-friendly, e.g. "Zone 2 Soil Moisture" |
| status | string | `active` \| `revoked` \| `offline` |
| paired_at | timestamp | |
| last_seen | timestamp | |
| synced | boolean | whether the pairing record has been pushed to the cloud registry |

Ingestion checks `status = 'active'` before writing anything to `conditions` — an unregistered or revoked `device_id` is rejected, not silently stored.

### `conditions`
Real-time sensor log — the highest write-volume table on the hub. Records greenhouse condition changes over time, each attributed to the specific device that reported it.

| Field | Type | Notes |
|---|---|---|
| id | integer, PK, autoincrement | local to this node — see composite-key note below |
| device_id | text, FK → connected_devices | which sensor produced this reading |
| metric | string | e.g. `soil_moisture`, `temperature`, `co2` |
| value | float | |
| recorded_at | timestamp | |
| synced | boolean | tracks whether this row has been pushed to cloud `conditions` |

Indexes: `(metric, recorded_at)` for rule-evaluation lookups, and a partial index on `synced = 0` so the sync job's "find everything pending" query stays cheap as the table grows across a season.

### `node_rules_cache`
Local copy of whichever `rules` are installed on this node (pulled from the cloud tier's `node_rules`), so the hub can evaluate rules and make decisions entirely offline.

| Field | Type | Notes |
|---|---|---|
| rule_id | integer, PK | |
| condition_json | json | e.g. `{"metric":"soil_moisture","op":"<","value":30}` |
| action_json | json | e.g. `{"actuator":"valve_1","command":"open"}` |
| version | integer | bumped on refresh, so the sync job can tell if the rule set changed without diffing every row |
| updated_at | timestamp | |

### `actions_log`
Every action taken in response to a condition — automated **or manual** — with enough context to trace *why* it happened. This is the audit trail: "why did the valve open at 3:14pm" resolves straight to the reading that caused it.

| Field | Type | Notes |
|---|---|---|
| id | integer, PK, autoincrement | |
| device_id | text, FK → connected_devices | the actuator that received the command |
| action | string | e.g. `open`, `close`, `set_temp:24` |
| triggered_by | string | `rule` \| `manual` \| `ml` |
| source_ref | string | `rule_id` when `triggered_by` is `rule`/`ml`; user/session/device id when `manual` |
| condition_id | integer, FK → conditions, nullable | the reading that triggered this action — null for manual overrides |
| executed_at | timestamp | |
| synced | boolean | tracks whether this row has been pushed to the cloud, for later fleet-wide use |

**Composite key note for sync:** local `id` values in `conditions` and `actions_log` are autoincrement integers, unique only *within this node's file*. When the sync job pushes rows up to the cloud tier, the cloud side must key on `(node_uid, local_id)`, not on local `id` alone — otherwise rows from different hubs will collide once aggregated.

---

## 4. Relationships and reasoning

| Relationship | Type | Why |
|---|---|---|
| `user_authentication` → `nodes` | 1:N | One farmer can own several GreenNode hubs. |
| `nodes` → `node_identity` | 1:1, shared key | Same physical hub, represented at two tiers. Cloud `nodes.node_id` matches edge `node_identity.node_uid` — this is what lets synced rows be traced back to a verified physical device rather than an arbitrary local id. |
| `nodes` → `node_rules` → `rules` | M:N via junction | A node can run several active rules; a rule (e.g. "vent if temp > 32°C for tomatoes") can apply to every tomato-crop hub on the platform. A direct `nodes → rules` link can't express this correctly. |
| `rules` ← `conditions` (cloud) | derived-from, not FK | Cloud `conditions` is the historical dataset the rule-mining model trains on; `rules` is the output. There's no live FK here, only a data-lineage/model-training relationship. |
| `node_identity` → `connected_devices` | 1:N | One hub pairs with many third-party sensors/actuators — each must be explicitly registered (paired) before its data is trusted. |
| `connected_devices` → `conditions` (edge) | 1:N | Each reading is attributed to the specific paired device that reported it, not just the hub in general — this is also the enforcement boundary: an unpaired or revoked `device_id` gets rejected at ingestion. |
| `conditions` (edge) → `conditions` (cloud) | batch sync, not FK | Local real-time readings periodically push into the cloud aggregate table, keyed by `(node_uid, local_id)`. This is a pipeline/job, not a relational constraint — hence the `synced` flag rather than a foreign key. |
| `node_rules` → `node_rules_cache` | periodic pull | The hub polls (or gets pushed) its active rule set from the cloud into a local cache, so rule evaluation never depends on the hub being online at decision time. |
| `conditions` (edge) → `actions_log` | 1:N, nullable | Every automated action links back to the exact reading that triggered it via `condition_id`, so any action is traceable to its cause. Manual overrides leave this null and use `triggered_by = 'manual'` with `source_ref` identifying who acted. |
| `connected_devices` → `actions_log` | 1:N | Every action is attributed to the specific actuator that received the command. |

---

## 5. How `rules` are derived from `conditions`

1. **Treat it as supervised learning.** Each `conditions` row is a labeled example: sensor state (temperature, humidity, soil_moisture, light, co2, time-of-day, crop_type) → the action that was taken.
2. **Use an interpretable model, not a black box.** A decision tree (e.g. `sklearn.tree.DecisionTreeClassifier`) or a rule-induction algorithm (RIPPER/CN2) — each root-to-leaf path reads directly as an if/then rule, which maps cleanly onto the `rules.condition` / `rules.action` json fields. A neural net would give accuracy but nothing storable as a legible rule.
3. **Extract each leaf as a `rules` row** — the conjunction of splits along that path becomes `condition`, the leaf's majority action becomes `action`, and the leaf's sample count/purity becomes the confidence/support fields.
4. **Re-train periodically** (nightly/weekly batch job) as `conditions` grows. Bump `model_version` and mark superseded rules `status = deprecated` rather than deleting them, so historical `actions_log` rows still resolve against the rule version that actually fired.
5. **Push down, don't poll live** — updated `node_rules` entries get pulled into each hub's `node_rules_cache` on a schedule (e.g. hourly), so decisions can still be made if the hub is offline when the greenhouse needs one.

This is deliberately lighter-weight than a TFLite/ONNX model — reserve those for genuinely complex prediction tasks (e.g. disease detection from imagery, yield forecasting), and keep the actuator decision loop itself interpretable and cheap to run on-device.

---

## 6. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Cloud/admin database | PostgreSQL + TimescaleDB | `conditions` as a hypertable for efficient time-series storage/queries; everything else as ordinary relational tables in the same instance — no separate system needed. |
| Edge/hub database | SQLite (WAL mode) | Zero-admin, file-based, minimal footprint — ideal for an RPi4/SD card. WAL mode allows the ingestion process and the rule-evaluation process to read/write concurrently without locking issues. |
| ORM | SQLAlchemy (shared models across both tiers) | Keeps the cloud and edge schemas defined from the same source, reducing drift as more hubs get deployed with different schema versions. |
| Migrations | Alembic | Versioned schema upgrades — important once hubs are in the field running different firmware/schema versions. |
| Sync transport | Mosquitto MQTT bridge (local broker → cloud broker), or a REST batch-push sync daemon | Reuses the MQTT infrastructure already used for actuator commands rather than standing up a second data pipeline. |
| Rule mining | scikit-learn (`DecisionTreeClassifier`) + APScheduler for the retraining job | Interpretable output that maps directly onto the `rules` json schema; cheap enough to run as a periodic batch job rather than needing dedicated ML infrastructure. |
| Backend API | FastAPI | Already the project's chosen backend; serves both the admin panel and the sync/ingestion endpoints. |
| Admin panel | Electron + React | Already decided; consumes the cloud tier directly. |
| Mobile app | React Native | Already decided. |